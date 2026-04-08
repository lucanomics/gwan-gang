// 검색 기능 강화를 위해 실무 표현이 대폭 추가된 비자 데이터베이스 (B-2, C-3 영구 제외)
const db = {
    "공통 안내": [
        { ko: "여권 보여주세요", cn: "护照看一下", py: "Hùzhào kàn yīxià" },
        { ko: "등록증 보여주세요", cn: "登录证看一下", py: "Dēnglùzhèng kàn yīxià" },
        { ko: "통합신청서 보여주세요", cn: "综合申请表看一下", py: "Zōnghé shēnqǐng biǎo kàn yīxià" },
        { ko: "수입인지 사오세요", cn: "去买印花税票", py: "Qù mǎi yìnhuā shuìpiào" },
        { ko: "복사기는 저기 있습니다", cn: "复印机在那边", py: "Fùyìnjī zài nàbiān" },
        { ko: "수수료 내세요", cn: "交手续费", py: "Jiāo shǒuxùfèi" }
    ],
    "D-2 (유학)": [
        { ko: "재학증명서 보여주세요", cn: "在学证明看一下", py: "Zàixué zhèngmíng kàn yīxià" },
        { ko: "성적증명서 보여주세요", cn: "成绩单看一下", py: "Chéngjìdān kàn yīxià" },
        { ko: "아르바이트 허가 신청서 줘", cn: "打工许可表给我", py: "Dǎgōng xǔkě biǎo gěi wǒ" },
        { ko: "시간제 취업 위반입니다", cn: "违反了打工规定", py: "Wéifǎn le dǎgōng guīdìng" },
        { ko: "체류지 변경 신고하세요", cn: "申报更改居住地", py: "Shēnbào gēnggǎi jūzhùdì" }
    ],
    "D-4 (일반연수)": [
        { ko: "재학증명서 보여주세요", cn: "在学证明看一下", py: "Zàixué zhèngmíng kàn yīxià" },
        { ko: "출석부 보여주세요", cn: "出勤表看一下", py: "Chūqín biǎo kàn yīxià" },
        { ko: "출석률이 부족합니다", cn: "出勤率不够", py: "Chūqínlǜ bùgòu" }
    ],
    "D-10 (구직)": [
        { ko: "졸업증명서 보여주세요", cn: "毕业证明看一下", py: "Bìyè zhèngmíng kàn yīxià" },
        { ko: "구직활동계획서 보여주세요", cn: "求职计划书看一下", py: "Qiúzhí jìhuàshū kàn yīxià" },
        { ko: "통장 거래내역서 보여주세요", cn: "银行流水看一下", py: "Yínháng liúshuǐ kàn yīxià" }
    ],
    "E-7 (특정활동)": [
        { ko: "고용계약서 보여주세요", cn: "劳动合同看一下", py: "Láodòng hétong kàn yīxià" },
        { ko: "사업자등록증 보여주세요", cn: "营业执照看一下", py: "Yíngyè zhízhào kàn yīxià" },
        { ko: "납세증명서 보여주세요", cn: "纳税证明看一下", py: "Nàshuì zhèngmíng kàn yīxià" },
        { ko: "경력증명서 보여주세요", cn: "经历证明看一下", py: "Jīnglì zhèngmíng kàn yīxià" }
    ],
    "E-8 (계절근로)": [
        { ko: "표준근로계약서 보여주세요", cn: "标准劳动合同看一下", py: "Biāozhǔn láodòng hétong kàn yīxià" },
        { ko: "무단이직은 불법입니다", cn: "擅自离职是违法的", py: "Shànzì lízhí shì wéifǎ de" },
        { ko: "지정된 농가에서만 일하세요", cn: "只能在指定农场工作", py: "Zhǐnéng zài zhǐdìng nóngchǎng gōngzuò" }
    ],
    "E-9 (비전문취업)": [
        { ko: "고용허가서 보여주세요", cn: "雇佣许可书看一下", py: "Gùyōng xǔkěshū kàn yīxià" },
        { ko: "근무처 변경 신청서 줘", cn: "变更工作申请表给我", py: "Biàngēng gōngzuò shēnqǐng biǎo gěi wǒ" },
        { ko: "여권 유효기간 확인하세요", cn: "确认护照有效期", py: "Quèrèn hùzhào yǒuxiàoqī" }
    ],
    "E-10 (선원취업)": [
        { ko: "선원근로계약서 보여주세요", cn: "船员劳动合同看一下", py: "Chuányuán láodòng hétong kàn yīxià" },
        { ko: "선원수첩 보여주세요", cn: "海员证看一下", py: "Hǎiyuánzhèng kàn yīxià" },
        { ko: "승선인가증 보여주세요", cn: "登船许可看一下", py: "Dēngchuán xǔkě kàn yīxià" }
    ],
    "F-1-5 (가족초청)": [
        { ko: "비취업서약서에 서명하세요", cn: "不就业誓约书签字", py: "Bù jiùyè shìyuēshū qiānzì" },
        { ko: "절대 취업하면 안 됩니다", cn: "绝对不能就业", py: "Juéduì bùnéng jiùyè" },
        { ko: "결핵검진 진단서 보여주세요", cn: "结核检查报告看一下", py: "Jiéhé jiǎnchá bàogào kàn yīxià" }
    ],
    "F-2 (거주)": [
        { ko: "점수표 보여주세요", cn: "打分表看一下", py: "Dǎfēn biǎo kàn yīxià" },
        { ko: "소득금액증명원 보여주세요", cn: "收入证明看一下", py: "Shōurù zhèngmíng kàn yīxià" },
        { ko: "임대차계약서 보여주세요", cn: "租房合同看一下", py: "Zūfáng hétong kàn yīxià" }
    ],
    "F-4 (재외동포)": [
        { ko: "거소증 보여주세요", cn: "居所证看一下", py: "Jūsuǒzhèng kàn yīxià" },
        { ko: "단순노무 취업은 안 됩니다", cn: "不能从事单纯劳务", py: "Bùnéng cóngshì dānchún láowù" },
        { ko: "해외범죄경력증명서 보여주세요", cn: "海外无犯罪记录看一下", py: "Hǎiwài wú fànzuì jìlù kàn yīxià" }
    ],
    "F-5 (영주)": [
        { ko: "영주증 재발급 신청서 주세요", cn: "永久居留证补发申请表给我", py: "Yǒngjiǔ jūliúzhèng bǔfā shēnqǐng biǎo gěi wǒ" },
        { ko: "범죄경력증명서 보여주세요", cn: "无犯罪记录证明看一下", py: "Wú fànzuì jìlù zhèngmíng kàn yīxià" },
        { ko: "기본소득 요건을 충족해야 합니다", cn: "需要满足基本收入要求", py: "Xūyào mǎnzú jīběn shōurù yāoqiú" }
    ],
    "F-6 (결혼이민)": [
        { ko: "혼인관계증명서 보여주세요", cn: "婚姻关系证明看一下", py: "Hūnyīn guānxì zhèngmíng kàn yīxià" },
        { ko: "가족관계증명서 보여주세요", cn: "家族关系证明看一下", py: "Jiāzú guānxì zhèngmíng kàn yīxià" },
        { ko: "주민등록등본 보여주세요", cn: "居民户口簿看一下", py: "Jūmín hùkǒubù kàn yīxià" },
        { ko: "한국인 배우자와 같이 오셨나요?", cn: "韩国配偶一起来了吗？", py: "Hánguó pèiǒu yīqǐ lái le ma?" }
    ],
    "G-1 (기타/난민)": [
        { ko: "난민인정신청서 주세요", cn: "难民认定申请书给我", py: "Nànmín rèndìng shēnqǐngshū gěi wǒ" },
        { ko: "수수료 면제입니다", cn: "免收手续费", py: "Miǎnshōu shǒuxùfèi" },
        { ko: "체류기간 연장 사유서 보여주세요", cn: "延期事由书看一下", py: "Yánqī shìyóushū kàn yīxià" }
    ],
    "H-2 (방문취업)": [
        { ko: "취업교육 이수증 보여주세요", cn: "就业教育结业证看一下", py: "Jiùyè jiàoyù jiéyèzhèng kàn yīxià" },
        { ko: "건강진단서 보여주세요", cn: "健康诊断书看一下", py: "Jiànkāng zhěnduànshū kàn yīxià" }
    ]
};

const navContainer = document.getElementById('category-nav');
const cardContainer = document.getElementById('card-container');
const searchInput = document.getElementById('search-input');
let activeCategory = "공통 안내";

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    } else {
        alert("브라우저에서 음성 재생을 지원하지 않습니다.");
    }
}

function createCard(item) {
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
}

function renderCards(category) {
    cardContainer.innerHTML = '';
    const items = db[category];
    items.forEach(item => createCard(item));
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    cardContainer.innerHTML = '';
    
    if (!term) {
        renderCards(activeCategory);
        document.querySelectorAll('.cat-btn').forEach(btn => {
            if(btn.textContent === activeCategory) btn.classList.add('active');
        });
        return;
    }

    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));

    const allItems = Object.values(db).flat();
    const results = allItems.filter(item => 
        item.ko.includes(term) || 
        item.py.toLowerCase().includes(term) || 
        item.cn.includes(term)
    );

    const uniqueResults = Array.from(new Set(results.map(a => a.ko)))
        .map(ko => {
            return results.find(a => a.ko === ko)
        });

    if (uniqueResults.length === 0) {
        cardContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px 0;">검색 결과가 없습니다.</div>';
    } else {
        uniqueResults.forEach(item => createCard(item));
    }
});

function init() {
    const categories = Object.keys(db);
    categories.forEach((cat, index) => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn';
        btn.textContent = cat;
        if (index === 0) btn.classList.add('active');
        
        btn.onclick = () => {
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
