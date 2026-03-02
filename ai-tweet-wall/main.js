/**
 * AI Tweet Hub - Core Logic
 */

const mockTweets = [
    {
        id: 1,
        user: "OpenAI",
        handle: "@OpenAI",
        content: "Introducing Sora — our text-to-video model. Sora can generate videos up to a minute long while maintaining visual quality and adherence to the user's prompt.",
        category: "video",
        date: "2026-02-24",
        likes: "1.2M",
        retweets: "250K",
        image: "Sora Video Preview"
    },
    {
        id: 2,
        user: "Sam Altman",
        handle: "@sama",
        content: "the world is going to move faster than we think. compute is the new currency.",
        category: "news",
        date: "2026-02-24",
        likes: "450K",
        retweets: "85K"
    },
    {
        id: 3,
        user: "Anthropic",
        handle: "@AnthropicAI",
        content: "Claude 4 Opus is now live. It outperforms GPT-4o on major benchmarks while maintaining a more conversational and nuanced tone.",
        category: "llm",
        date: "2026-02-23",
        likes: "320K",
        retweets: "42K",
        image: "Claude 4 Benchmark"
    },
    {
        id: 4,
        user: "Greg Brockman",
        handle: "@gdb",
        content: "AI safety isn't just a research topic; it's the foundation of everything we build. Thinking deeply about alignment every single day.",
        category: "news",
        date: "2026-02-22",
        likes: "120K",
        retweets: "18K"
    },
    {
        id: 5,
        user: "Midjourney",
        handle: "@midjourney",
        content: "V7 is coming soon. Enhanced texture mapping, photo-realism that will blur the lines of reality, and unprecedented prompt coherence.",
        category: "image",
        date: "2026-02-24",
        likes: "890K",
        retweets: "110K",
        image: "MJ V7 Generation"
    },
    {
        id: 6,
        user: "Andrej Karpathy",
        handle: "@karpathy",
        content: "Llama 4 is essentially a supercomputer in your pocket. Quantization techniques are making 400B+ parameters run on consumer hardware.",
        category: "llm",
        date: "2026-02-24",
        likes: "210K",
        retweets: "35K"
    },
    {
        id: 7,
        user: "DeepMind",
        handle: "@GoogleDeepMind",
        content: "Gemini 2.5 Flash released. Optimized for edge devices with a 2M token context window. Speed and scale combined.",
        category: "llm",
        date: "2026-02-23",
        likes: "150K",
        retweets: "28K"
    },
    {
        id: 8,
        user: "Perplexity",
        handle: "@perplexity_ai",
        content: "The era of traditional search is over. Reasoning-first discovery is the future. Try our new Pro Search with deep research capabilities.",
        category: "news",
        date: "2026-02-21",
        likes: "95K",
        retweets: "12K"
    },
    {
        id: 9,
        user: "Runway",
        handle: "@runwayml",
        content: "Gen-4 is here. Cinematic control, multi-camera consistency, and real-time interactive generation. Filmmaking just evolved.",
        category: "video",
        date: "2026-02-24",
        likes: "420K",
        retweets: "68K",
        image: "Runway Gen-4 Demo"
    },
    {
        id: 10,
        user: "Stability AI",
        handle: "@StabilityAI",
        content: "Stable Diffusion 4 Ultra. Open weights, local first, 8K resolution support. The community's dream realized.",
        category: "image",
        date: "2026-02-22",
        likes: "310K",
        retweets: "55K"
    },
    {
        id: 11,
        user: "Demis Hassabis",
        handle: "@demishassabis",
        content: "AlphaFold 4 just predicted the structure of every known protein in minutes. Biology is now an engineering problem.",
        category: "news",
        date: "2026-02-24",
        likes: "280K",
        retweets: "44K"
    },
    {
        id: 12,
        user: "NVIDIA AI",
        handle: "@NVIDIAAI",
        content: "Blackwell GPUs are shipping. Doubling AI training performance and reducing inference costs by 25x. The engine of the new industrial revolution.",
        category: "news",
        date: "2026-02-23",
        likes: "560K",
        retweets: "92K"
    },
    {
        id: 13,
        user: "Elon Musk",
        handle: "@elonmusk",
        content: "Grok 3 is currently training on the largest compute cluster in the world. It will be something special.",
        category: "llm",
        date: "2026-02-24",
        likes: "780K",
        retweets: "120K"
    },
    {
        id: 14,
        user: "Lex Fridman",
        handle: "@lexfridman",
        content: "Just finished a 5-hour conversation with the lead architect of Sora. The future of reality is about to get very interesting.",
        category: "news",
        date: "2026-02-24",
        likes: "180K",
        retweets: "25K"
    },
    {
        id: 15,
        user: "AI Daily",
        handle: "@aidaily",
        content: "TOP 10 AI TOOLS THIS WEEK:\n1. Sora (Video)\n2. Claude 4 (LLM)\n3. Midjourney V7\n4. Suno V5 (Music)\n5. Devin 2.0 (Coding)",
        category: "news",
        date: "2026-02-24",
        likes: "45K",
        retweets: "12K"
    },
    {
        id: 16,
        user: "Suno",
        handle: "@suno_ai_",
        content: "Suno V5 is now in beta. Professional grade stem separation and 48khz audio quality. AI music is no longer a toy.",
        category: "news",
        date: "2026-02-23",
        likes: "120K",
        retweets: "34K"
    }
];

// State
let currentFilter = 'all';
let searchQuery = '';
let isDense = false;

// DOM Elements
const tweetContainer = document.getElementById('tweetContainer');
const searchInput = document.getElementById('tweetSearch');
const filterTags = document.querySelectorAll('.tag');
const toggleDenseBtn = document.getElementById('toggleDense');
const refreshBtn = document.getElementById('refreshData');

/**
 * Initialize the app
 */
function init() {
    renderTweets();
    setupEventListeners();
}

/**
 * Render tweets based on current state
 */
function renderTweets() {
    // Show loading state briefly
    tweetContainer.innerHTML = '';

    const filtered = mockTweets.filter(tweet => {
        const matchesFilter = currentFilter === 'all' || tweet.category === currentFilter;
        const matchesSearch = tweet.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tweet.user.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0) {
        tweetContainer.innerHTML = `
            <div class="loader-container">
                <p>一致するツイートが見つかりませんでした。</p>
            </div>
        `;
        return;
    }

    filtered.forEach((tweet, index) => {
        const card = createTweetCard(tweet);
        card.style.animationDelay = `${index * 0.05}s`;
        tweetContainer.appendChild(card);
    });
}

/**
 * Create a tweet card element
 */
function createTweetCard(tweet) {
    const card = document.createElement('div');
    card.className = 'tweet-card';

    card.innerHTML = `
        <div class="card-header">
            <div class="avatar"></div>
            <div class="user-info">
                <span class="name">${tweet.user}</span>
                <span class="handle">${tweet.handle}</span>
            </div>
        </div>
        <div class="tweet-content">${tweet.content}</div>
        ${tweet.image ? `<div class="tweet-media">${tweet.image}</div>` : ''}
        <div class="card-footer">
            <span class="date">${tweet.date}</span>
            <div class="stats">
                <div class="stat-item">
                    <span>🔁</span> ${tweet.retweets}
                </div>
                <div class="stat-item">
                    <span>❤️</span> ${tweet.likes}
                </div>
            </div>
        </div>
    `;

    return card;
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTweets();
    });

    // Filter Tags
    filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            currentFilter = tag.dataset.filter;
            renderTweets();
        });
    });

    // Toggle Dense Mode
    toggleDenseBtn.addEventListener('click', () => {
        isDense = !isDense;
        tweetContainer.classList.toggle('dense-mode', isDense);
        toggleDenseBtn.innerHTML = isDense ?
            '<span class="icon">🔍</span> 拡大表示' :
            '<span class="icon">📱</span> 密度を最大化';
        renderTweets(); // Re-render to apply density logic if needed
    });

    // Refresh (Simulate)
    refreshBtn.addEventListener('click', () => {
        const btn = refreshBtn;
        btn.innerHTML = '<span class="icon spinner">🔄</span> 更新中...';
        btn.disabled = true;

        // Add random "newly discovered" tweet
        setTimeout(() => {
            const newTweet = {
                id: Date.now(),
                user: "Breakthrough AI",
                handle: "@breakthrough_ai",
                content: "BREAKING: Researchers have found a way to achieve linear time complexity for transformers. Context windows now effectively infinite.",
                category: "news",
                date: "Today",
                likes: "15.4K",
                retweets: "2.1K"
            };
            mockTweets.unshift(newTweet);
            renderTweets();

            btn.innerHTML = '<span class="icon">🔄</span> 更新完了';
            setTimeout(() => {
                btn.innerHTML = '<span class="icon">🔄</span> 更新';
                btn.disabled = false;
            }, 2000);
        }, 1500);
    });
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
