document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = document.getElementById('chatHistory');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    // Modal elements
    const nameModal = document.getElementById('nameModal');
    const startChatBtn = document.getElementById('startChatBtn');
    const ojisanNameInput = document.getElementById('ojisanNameInput');
    const userNameInput = document.getElementById('userNameInput');
    const headerOjisanName = document.getElementById('headerOjisanName');

    let ojisanName = "誠";
    let userName = "美香";
    let messageCount = 0;

    // --- Modal Logic ---
    startChatBtn.addEventListener('click', () => {
        ojisanName = ojisanNameInput.value.trim() || "誠";
        userName = userNameInput.value.trim() || "美香";

        headerOjisanName.innerText = `${ojisanName}✨😃`;
        nameModal.style.display = 'none';
        document.body.classList.remove('is-modal-open');

        // Initial greeting
        showTypingIndicator();
        setTimeout(() => {
            hideTypingIndicator();
            const initialMsg = `${userName}チャン、オハヨウ😃❗今日ハ何シテルノカナ❓✨`;
            appendMessage(initialMsg, 'received');
        }, 1000);
    });

    // Ojisan configuration
    const EMOJIS = ['❗', '❓', '💦', '😃', '✨', '🍰', '🎵', '😜', '💕', '✋', '💡', '🍴', '🏨'];
    const OJISAN_NAMES_POOL = ['太郎', '健一', '誠', 'ひろし', 'よしお'];
    const MEALS = ['イタリアン', 'お寿司', 'ステーキ', '居酒屋', 'カフェ'];

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';

        if (userInput.value.trim() !== '') {
            sendBtn.classList.add('active');
        } else {
            sendBtn.classList.remove('active');
        }
    });

    // Send logic
    const sendMessage = () => {
        const text = userInput.value.trim();
        if (!text) return;

        // User Message
        appendMessage(text, 'sent');
        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.classList.remove('active');
        messageCount++;

        // Ojisan Reply (Delayed)
        showTypingIndicator();
        setTimeout(() => {
            const ojisanText = generateOjisanResponse(text);
            hideTypingIndicator();
            appendMessage(ojisanText, 'received');
        }, 1500);
    };

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Suggestions
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const type = chip.dataset.type;
            let text = "";
            if (type === 'greeting') text = "こんにちは！";
            if (type === 'dinner') text = "今度ご飯行きませんか？";
            if (type === 'advice') text = "悩みがあるんです...";
            if (type === 'flattery') text = "かっこいいですね！";

            userInput.value = text;
            userInput.dispatchEvent(new Event('input'));
        });
    });

    // Message Display
    function appendMessage(text, type) {
        const group = document.createElement('div');
        group.className = `message-group ${type}`;

        const now = new Date();
        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (type === 'received') {
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.innerText = '👴';
            group.appendChild(avatar);
        }

        const content = document.createElement('div');
        content.className = 'message-content';

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerText = text;

        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.innerText = timeStr;

        content.appendChild(bubble);
        content.appendChild(timestamp);
        group.appendChild(content);

        chatHistory.appendChild(group);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function showTypingIndicator() {
        const div = document.createElement('div');
        div.id = 'typingIndicator';
        div.className = 'typing-indicator received';
        div.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
        chatHistory.appendChild(div);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function hideTypingIndicator() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    // --- Ojisan Logic ---
    function generateOjisanResponse(inputText) {
        const randomMeal = MEALS[Math.floor(Math.random() * MEALS.length)];
        const addEmoji = () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

        // Rule-based expansion
        const greetings = [
            `${userName}チャン、オハヨウ😃❗`,
            `コンニチハ✨今日もいい天気だネ🎵`,
            `元気カナ❓💦`,
            `ヤッホー😜✨`,
            `オツカレサマ〜✋💡`
        ];

        const followups = [
            `今度${randomMeal}でも行こうヨ🍴✨`,
            `ボクも${userName}チャンのこと応援シテルヨ🎵`,
            `無理シナイデネ💦💡`,
            `連絡待ってるネ😜💕`,
            `またゆっくりお話ししたいナ✨`
        ];

        let base = inputText;

        // Katakana-ize common particles and endings (The Ojisan Signature)
        const replacements = [
            { h: 'ですね', k: 'デスネ' },
            { h: 'ます', k: 'マス' },
            { h: 'です', k: 'デス' },
            { h: 'だよ', k: 'ダヨ' },
            { h: 'だね', k: 'ダネ' },
            { h: 'かな', k: 'カナ' },
            { h: 'かな？', k: 'カナ❓' },
            { h: 'だよ！', k: 'ダヨ❗' },
            { h: 'いいよ', k: 'イイヨ' },
            { h: 'いよ', k: 'イヨ' },
            { h: 'の？', k: 'ノ❓' },
            { h: 'の！', k: 'ノ❗' },
            { h: '！', k: '❗' },
            { h: '？', k: '❓' },
            { h: '楽しみ', k: '楽シミ' },
            { h: '無理', k: '無理' },
            { h: '頑張って', k: '頑張ッテ' },
            { h: 'ちゃん', k: 'チャン' }
        ];

        replacements.forEach(r => {
            base = base.split(r.h).join(r.k);
        });

        // Insert random emojis in middle
        const words = base.split('');
        if (words.length > 5) {
            const index = Math.floor(words.length / 2);
            words.splice(index, 0, addEmoji());
        }
        base = words.join('');

        // Special ROAS message (every 3 messages)
        if (messageCount % 3 === 0) {
            base += `💦\nデモ、チャンとお仕事もしテ、ROASをチャンと出サナイトネ(^_^;)${addEmoji()}`;
        }

        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        const followup = followups[Math.floor(Math.random() * followups.length)];

        return `${greeting}${addEmoji()}\n${base}${addEmoji()}${addEmoji()}\n${followup}${addEmoji()}`;
    }
});
