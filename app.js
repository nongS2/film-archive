/* =========================================
   공통 도구
   ========================================= */

// 글 안의 <, > 같은 기호가 코드로 읽히지 않게 바꿔 줌
function esc(s) {
  return String(s ?? "").trim().replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

// 배경색이 밝으면 검은 글씨, 어두우면 흰 글씨
function inkOn(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#000" : "#fff";
}

const GOAL = 8; // 목표 편수 → 남은 칸만큼 빈 자리를 보여 줌


/* =========================================
   메인 페이지 (index.html)
   ========================================= */
const shelf = document.getElementById("shelf");

if (shelf) {
  const caption = document.getElementById("caption");
  const hint = FILMS.length
    ? "포스터를 누르면 분석을 볼 수 있어요."
    : "첫 번째 기록을 준비하고 있어요.";

  caption.textContent = hint;
  document.getElementById("count").textContent = `${FILMS.length}편 기록 / 목표 ${GOAL}편`;

  const slots = Math.max(GOAL, FILMS.length);

  for (let i = 0; i < slots; i++) {
    const f = FILMS[i];

    // 아직 채워지지 않은 자리
    if (!f) {
      const empty = document.createElement("span");
      empty.className = "card empty";
      empty.setAttribute("aria-hidden", "true");
      shelf.appendChild(empty);
      continue;
    }

    // 영화 카드 (누르면 film.html?id=... 로 이동)
    const card = document.createElement("a");
    card.className = "card";
    card.href = `film.html?id=${encodeURIComponent(f.id)}`;
    card.style.setProperty("--film", f.color);
    card.setAttribute("aria-label", `${f.title} (${f.year}) 분석 보기`);

    if (f.poster) {
      card.innerHTML = `<img src="${esc(f.poster)}" alt="" loading="lazy">`;
    } else {
      // 포스터가 없으면 대표 색 블록
      card.classList.add("block");
      card.style.color = inkOn(f.color);
      card.innerHTML = `<span>${esc(f.title)}</span>`;
    }

    // 마우스를 올리면: 배경이 그 영화의 대표 색으로 살짝 물듦 + 캡션 변경
    const show = () => {
      document.body.style.setProperty("--wash", `color-mix(in srgb, ${f.color} 16%, #fff)`);
      caption.innerHTML = `<b>${esc(f.title)}</b> <span class="mute">${esc(f.year)}</span>`
        + (f.oneLine ? `<span class="line">${esc(f.oneLine)}</span>` : "");
    };
    const hide = () => {
      document.body.style.removeProperty("--wash");
      caption.textContent = hint;
    };
    card.addEventListener("mouseenter", show);
    card.addEventListener("focus", show);
    card.addEventListener("mouseleave", hide);
    card.addEventListener("blur", hide);

    shelf.appendChild(card);
  }
}


/* =========================================
   분석 페이지 (film.html)
   ========================================= */
const filmRoot = document.getElementById("film");

if (filmRoot) {
  const id = new URLSearchParams(location.search).get("id");
  const f = FILMS.find(x => x.id === id);

  if (!f) {
    filmRoot.innerHTML = `<p class="missing">이 영화를 찾을 수 없어요. <a href="./">목록으로 돌아가기</a></p>`;
  } else {
    document.title = `${f.title} | 영화 아카이브`;
    document.body.style.setProperty("--film", f.color);

    // ── 용어 설명: 글 속 용어를 찾아서, 처음 나올 때 한 번만 버튼으로 바꿈 ──
    const glossary = (typeof GLOSSARY !== "undefined") ? GLOSSARY : {};
    const termList = Object.keys(glossary).sort((a, b) => b.length - a.length); // 긴 용어 먼저 (롱 숏 > 숏)
    const termRegex = termList.length
      ? new RegExp(termList.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g")
      : null;
    const used = new Set();

    const withTerms = text => {
      const safe = esc(text);
      if (!termRegex) return safe;
      return safe.replace(termRegex, term => {
        if (used.has(term)) return term;
        used.add(term);
        return `<button type="button" class="term" data-term="${term}">${term}</button>`;
      });
    };

    // 내용이 있을 때만 그 칸을 만듦
    const section = (title, html) => html ? `<section><h2>${title}</h2>${html}</section>` : "";
    const prose = text => text ? `<p class="prose">${withTerms(text)}</p>` : "";

    const words = (f.words || []).filter(Boolean);
    const firstLook =
      (words.length ? `<p class="words">${words.map(w => `<span>${esc(w)}</span>`).join("")}</p>` : "")
      + prose(f.oneLine);

    const seq = f.sequence || {};
    const scene = (seq.time || seq.summary)
      ? `<p class="stamp">${esc(seq.time)}</p>${prose(seq.summary)}` : "";

    const choices = (f.choices || []).map(c => `
      <div class="choice">
        <h3><span class="area">${esc(c.area)}</span>${esc(c.element)}</h3>
        <dl>
          <dt>표현 <i>How</i></dt><dd>${withTerms(c.how)}</dd>
          <dt>효과 <i>Effect</i></dt><dd>${withTerms(c.effect)}</dd>
          <dt>의미 <i>Meaning</i></dt><dd>${withTerms(c.meaning)}</dd>
        </dl>
      </div>`).join("");

    const symbols = (f.symbols || []).filter(s => s.name).map(s => `
      <div class="symbol"><h3>${esc(s.name)}</h3>${prose(s.meaning)}</div>`).join("");

    filmRoot.innerHTML = `
      <div class="film-side">
        <div class="film-poster">
          ${f.poster ? `<img src="${esc(f.poster)}" alt="${esc(f.title)} 포스터">` : ""}
        </div>
        ${f.poster ? `<p class="credit">포스터 © 각 제작·배급사</p>` : ""}
      </div>

      <article class="film-body">
        <h1 class="film-title">${esc(f.title)}</h1>

        <dl class="facts">
          <dt>감독</dt><dd>${esc(f.director)}</dd>
          <dt>개봉</dt><dd>${esc(f.year)}</dd>
          <dt>장르</dt><dd>${esc(f.genre)}</dd>
          <dt>감상일</dt><dd>${esc(f.watched)}</dd>
          <dt>대표 색</dt>
          <dd><span class="chip"></span>${esc(f.color)}
            ${f.colorReason ? `<span class="reason">${esc(f.colorReason)}</span>` : ""}</dd>
        </dl>

        ${section("첫인상", firstLook)}

        <!-- 여기부터 스포일러: 처음엔 흐리게 가려져 있음 -->
        <div class="gate">
          <p>여기부터 결말을 포함한 내용이 있어요.</p>
          <button type="button" class="gate-btn" aria-controls="spoiler" aria-expanded="false">스포일러 보기</button>
        </div>

        <div class="spoiler is-hidden" id="spoiler" inert>
          ${section("핵심 장면", scene)}
          ${section("영화적 선택", choices)}
          ${section("상징", symbols)}
          ${section("종합 해석", f.interpretation ? `<p class="verdict">${withTerms(f.interpretation)}</p>` : "")}
          ${section("나에게 남은 것", prose(f.takeaway))}
        </div>
      </article>`;

    // 스포일러 버튼: 누르면 보이고, 다시 누르면 다시 가려짐
    const btn = filmRoot.querySelector(".gate-btn");
    const spoiler = document.getElementById("spoiler");

    btn.addEventListener("click", () => {
      const hidden = spoiler.classList.toggle("is-hidden");
      spoiler.inert = hidden;                        // 가려져 있을 땐 클릭·선택·읽기 막기
      btn.textContent = hidden ? "스포일러 보기" : "다시 가리기";
      btn.setAttribute("aria-expanded", String(!hidden));
    });

    // 용어 설명 말풍선: 마우스를 올리거나, 누르거나, Tab으로 가면 뜸
    const tip = document.createElement("div");
    tip.className = "tip";
    tip.id = "tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);

    const showTip = el => {
      const term = el.dataset.term;
      tip.innerHTML = `<b>${esc(term)}</b>${esc(glossary[term])}`;
      tip.classList.add("on");
      el.setAttribute("aria-describedby", "tip");

      // 화면 밖으로 안 나가게 위치 계산 (기본은 단어 위, 공간 없으면 아래)
      const r = el.getBoundingClientRect();
      const w = tip.offsetWidth, h = tip.offsetHeight;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    };
    const hideTip = () => {
      tip.classList.remove("on");
      filmRoot.querySelectorAll(".term[aria-describedby]").forEach(t => t.removeAttribute("aria-describedby"));
    };

    filmRoot.querySelectorAll(".term").forEach(el => {
      el.addEventListener("mouseenter", () => showTip(el));
      el.addEventListener("mouseleave", hideTip);
      el.addEventListener("focus", () => showTip(el));
      el.addEventListener("blur", hideTip);
      el.addEventListener("click", () => showTip(el)); // 휴대폰은 누르면 뜸
    });
    window.addEventListener("scroll", hideTip, { passive: true });
    document.addEventListener("keydown", e => { if (e.key === "Escape") hideTip(); });
  }
}
