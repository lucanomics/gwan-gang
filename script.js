const db = {
    "공통 안내": [
        { ko: "안녕하세요", cn: "你好", py: "Nǐ hǎo" },
        { ko: "잠깐만 기다려요", cn: "等一下", py: "Děng yīxià" },
        { ko: "앉으세요", cn: "坐一下", py: "Zuò yīxià" },
        { ko: "번호표 뽑으세요", cn: "拿一下号", py: "Ná yīxià hào" },
        { ko: "이쪽으로 오세요", cn: "来这边", py: "Lái zhèbiān" }
    ],
    "기본 서류 확인": [
        { ko: "여권 보여주세요", cn: "护照看一下", py: "Hùzhào kàn yīxià" },
        { ko: "등록증(거소증) 보여주세요", cn: "登录证看一下", py: "Dēnglùzhèng kàn yīxià" },
        { ko: "통합신청서 보여주세요", cn: "综合申请表看一下", py: "Zōnghé shēnqǐng biǎo kàn yīxià" },
        { ko: "여기 사인하세요", cn: "这儿签字", py: "Zhèr qiānzì" },
        { ko: "복사본 필요해요", cn: "要复印件", py: "Yào fùyìnjiàn" }
    ],
    "무사증/단기 (B-2/C-3)": [
        { ko: "K-ETA 보여주세요", cn: "K-ETA 看一下", py: "K-ETA kàn yīxià" },
        { ko: "왕복항공권 보여주세요", cn: "回程机票看一下", py: "Huíchéng jīpiào kàn yīxià" },
        { ko: "숙소 예약증 보여주세요", cn: "酒店预订单看一下", py: "Jiǔdiàn yùdìngdān kàn yīxià" },
        { ko: "단기비자는 연장 안 됩니다", cn: "短期签证不能延期", py: "Duǎnqī qiānzhèng bùnéng yánqī" }
    ],
    "유학/연수 (D-2/D-4)": [
        { ko: "재학증명서 보여주세요", cn: "在学证明看一下", py: "Zàixué zhèngmíng kàn yīxià" },
        { ko: "성적증명서 보여주세요", cn: "成绩单看一下", py: "Chéngjìdān kàn yīxià" },
        { ko: "출석부 보여주세요", cn: "出勤表看一下", py: "Chūqín biǎo kàn yīxià" },
        { ko: "아르바이트 허가 신청서 줘", cn: "打工许可表给我", py: "Dǎgōng xǔkě biǎo gěi wǒ" }
    ],
    "근로/취업 (E-9/E-8/E-7)": [
        { ko: "고용계약서 보여주세요", cn: "劳动合同看一下", py: "Láodòng hétong kàn yīxià" },
        { ko: "사업자등록증 보여주세요", cn: "营业执照看一下", py: "Yíngyè zhízhào kàn yīxià" },
        { ko: "근무처 변경 신청서 줘", cn: "变更工作申请表给我", py: "Biàngēng gōngzuò shēnqǐng biǎo gěi wǒ" }
    ],
    "결혼/가족 (F-6/F-1-5)": [
        { ko: "혼인관계증명서 보여주세요", cn: "婚姻关系证明看一下", py: "Hūnyīn guānxì zhèngmíng kàn yīxià" },
        { ko: "가족관계증명서 보여주세요", cn: "家族关系证明看一下", py: "Jiāzú guānxì zhèngmíng kàn yīxià" },
        { ko: "주민등록등본 보여주세요", cn: "居民户口簿看一下", py: "Jūmín hùkǒubù kàn yīxià" },
        { ko: "비취업서약서에 서명하세요", cn: "不就业誓约书签字", py: "Bù jiùyè shìyuēshū qiānzì" }
    ],
    "거주/영주 (F-2/F-5)": [
        { ko: "소득금액증명원 보여주세요", cn: "收入证明看一下", py: "Shōurù zhèngmíng kàn yīxià" },
        { ko: "점수표 보여주세요", cn: "打分表看一下", py: "Dǎfēn biǎo kàn yīxià" },
        { ko: "범죄경력증명서 보여주세요", cn: "无犯罪记录证明看一下", py: "Wú fànzuì jìlù zhèngmíng kàn yīxià" }
    ],
    "지문/수납/마무리": [
        { ko: "검지 손가락 올려요", cn: "手指放上去", py: "Shǒuzǐ fàng shàngqù" },
        { ko: "카메라 보세요", cn: "看摄像头", py: "Kàn shèxiàngtóu" },
        { ko: "수수료 내세요", cn: "交手续费", py: "Jiāo shǒuxùfèi" },
        { ko: "다 됐어요", cn: "好了", py: "Hǎo le" },
        { ko: "안녕히 가세요", cn: "慢走", py: "Màn zǒu" }
    ]
};

const navContainer = document.getElementById('category-nav');
const cardContainer = document.getElementById('card-container');
const searchInput = document.getElementById('search-input');
let activeCategory = "공통 안내";

// TTS 재생 기능
function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN'; 
        utterance.rate = 0.9; 
        window.speechSynthesis.speak(utterance);
    } else {
        alert("이 브라우저에서는 음성 재생을 지원하지 않습니다.");
    }
}

// 단일 카드 생성 함수
function createCard(item) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div>
            <div class="ko-text">${item.ko}</div>
            <div class="cn-text">${item.cn}</div>
            <div class="py-text">${item.py}</div>
        </div>
        <button class="tts-btn" onclick="speak('${item.cn}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            발음 듣기
        </button>
    `;
    cardContainer.appendChild(card);
}

// 선택된 카테고리 렌더링
function renderCards(category) {
    cardContainer.innerHTML = '';
    const items = db[category];
    items.forEach(item => createCard(item));
}

// 검색 기능 로직
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    cardContainer.innerHTML = '';
    
    // 검색어가 없으면 현재 활성화된 카테고리로 복구
    if (!term) {
        renderCards(activeCategory);
        document.querySelectorAll('.cat-btn').forEach(btn => {
            if(btn.textContent === activeCategory) btn.classList.add('active');
        });
        return;
    }

    // 검색 시 모든 버튼 선택 해제
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));

    // DB 전체에서 검색어 포함 객체 필터링 (한국어, 병음, 한자)
    const allItems = Object.values(db).flat();
    const results = allItems.filter(item => 
        item.ko.includes(term) || 
        item.py.toLowerCase().includes(term) || 
        item.cn.includes(term)
    );

    // 중복 제거 후 렌더링
    const uniqueResults = Array.from(new Set(results.map(a => a.ko)))
        .map(ko => {
            return results.find(a => a.ko === ko)
        });

    if (uniqueResults.length === 0) {
        cardContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #6c757d; padding: 40px 0;">검색 결과가 없습니다.</div>';
    } else {
        uniqueResults.forEach(item => createCard(item));
    }
});

// 초기화
function init() {
    const categories = Object.keys(db);
    categories.forEach((cat, index) => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.textContent = cat;
        if (index === 0) btn.classList.add('active');
        
        btn.onclick = () => {
            // 검색창 초기화
            searchInput.value = '';
            activeCategory = cat;
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCards(cat);
        };
        navContainer.appendChild(btn);
    });
    
    renderCards(categories[0]);
}

document.addEventListener('DOMContentLoaded', init);
