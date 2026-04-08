const db = {
    "공통 안내": [
        { ko: "안녕하세요", cn: "你好", py: "Nǐ hǎo" },
        { ko: "잠깐만 기다려요", cn: "等一下", py: "Děng yīxià" },
        { ko: "앉으세요", cn: "坐一下", py: "Zuò yīxià" },
        { ko: "번호표 뽑으세요", cn: "拿一下号", py: "Ná yīxià hào" },
        { ko: "이쪽으로 오세요", cn: "来这边", py: "Lái zhèbiān" }
    ],
    "서류 확인": [
        { ko: "여권 보여주세요", cn: "护照看一下", py: "Hùzhào kàn yīxià" },
        { ko: "등록증 보여주세요", cn: "登录证看一下", py: "Dēnglùzhèng kàn yīxià" },
        { ko: "신청서 보여주세요", cn: "表看一下", py: "Biǎo kàn yīxià" },
        { ko: "여기 사인하세요", cn: "这儿签字", py: "Zhèr qiānzì" },
        { ko: "복사본 필요해요", cn: "要复印件", py: "Yào fùyìnjiàn" }
    ],
    "비자 특화": [
        { ko: "(유학) 재학증명서 줘", cn: "在学证给我", py: "Zàixuézhèng gěi wǒ" },
        { ko: "(유학) 성적증명서 보여줘", cn: "成绩单看一下", py: "Chéngjìdān kàn yīxià" },
        { ko: "(취업) 표준근로계약서 줘", cn: "合同给我", py: "Hétong gěi wǒ" },
        { ko: "(취업) 사업자등록증 보여줘", cn: "营业执照看一下", py: "Yíngyè zhízhào kàn yīxià" },
        { ko: "(결혼) 가족관계증명서 줘", cn: "家族关系证给我", py: "Jiāzú guānxì zhèng gěi wǒ" }
    ],
    "지문/사진": [
        { ko: "검지 손가락 올려요", cn: "手指放上去", py: "Shǒuzǐ fàng shàngqù" },
        { ko: "카메라 보세요", cn: "看摄像头", py: "Kàn shèxiàngtóu" },
        { ko: "안경 벗으세요", cn: "摘下眼镜", py: "Zhāixià yǎnjìng" }
    ],
    "수납/마무리": [
        { ko: "수수료 내세요", cn: "交手续费", py: "Jiāo shǒuxùfèi" },
        { ko: "다 됐어요", cn: "好了", py: "Hǎo le" },
        { ko: "안녕히 가세요", cn: "慢走", py: "Màn zǒu" }
    ]
};

const navContainer = document.getElementById('category-nav');
const cardContainer = document.getElementById('card-container');

// 음성 재생 함수 (TTS)
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN'; 
        window.speechSynthesis.speak(utterance);
    } else {
        alert("이 브라우저에서는 음성 재생을 지원하지 않습니다.");
    }
}

// 카드 렌더링 함수
function renderCards(category) {
    cardContainer.innerHTML = '';
    const items = db[category];
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div>
                <div class="ko-text">${item.ko}</div>
                <div class="cn-text">${item.cn}</div>
                <div class="py-text">${item.py}</div>
            </div>
            <button class="tts-btn" onclick="speak('${item.cn}')">🔊 발음 듣기</button>
        `;
        cardContainer.appendChild(card);
    });
}

// 카테고리 버튼 생성
function init() {
    const categories = Object.keys(db);
    categories.forEach((cat, index) => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.textContent = cat;
        if (index === 0) btn.classList.add('active');
        
        btn.onclick = () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCards(cat);
        };
        navContainer.appendChild(btn);
    });
    
    // 초기 화면에 첫 번째 카테고리 렌더링
    renderCards(categories[0]);
}

init();
