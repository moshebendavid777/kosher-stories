document.addEventListener('DOMContentLoaded', function () {

    const console = createDebugConsole(window.console);


    const viewer = document.getElementById('kosher-stories-viewer');
    const content = document.querySelector('.kosher-stories-content');
    const storyBody = document.querySelector('.kosher-stories-body');
    const close = document.querySelector('.kosher-close');

    let currentCategoryIndex = 0;
    const categories = Array.from(document.querySelectorAll('.kosher-story-thumb'));

    let currentTermId = null;
    const analyticsSessionId = getAnalyticsSessionId();
    let analyticsQueue = [];
    let analyticsFlushTimer = null;

    if (!viewer || !content || !storyBody) return;

    function createDebugConsole(nativeConsole) {
        let enabled = false;

        try {
            enabled = localStorage.getItem('kayco_stories_debug') === '1';
        } catch (error) {
            enabled = false;
        }

        return {
            log: function () {
                if (enabled && nativeConsole && nativeConsole.log) {
                    nativeConsole.log.apply(nativeConsole, arguments);
                }
            },
            warn: function () {
                if (enabled && nativeConsole && nativeConsole.warn) {
                    nativeConsole.warn.apply(nativeConsole, arguments);
                }
            },
            error: function () {
                if (enabled && nativeConsole && nativeConsole.error) {
                    nativeConsole.error.apply(nativeConsole, arguments);
                }
            }
        };
    }

    function getAnalyticsSessionId() {
        const key = 'kayco_story_session_id';
        let sessionId = sessionStorage.getItem(key);

        if (!sessionId) {
            sessionId = 'story_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
            sessionStorage.setItem(key, sessionId);
        }

        return sessionId;
    }

    function queueStoryEvent(event) {
        analyticsQueue.push({
            sessionId: analyticsSessionId,
            timestamp: Date.now(),
            ...event
        });

        if (analyticsQueue.length >= 12) {
            flushStoryEvents();
            return;
        }

        clearTimeout(analyticsFlushTimer);
        analyticsFlushTimer = setTimeout(flushStoryEvents, 1200);
    }

    function flushStoryEvents(useBeacon = false) {
        if (!analyticsQueue.length) {
            return;
        }

        const events = analyticsQueue.splice(0, analyticsQueue.length);
        const body = new URLSearchParams({
            action: 'kayco_track_story_events',
            events: JSON.stringify(events)
        });

        if (useBeacon && navigator.sendBeacon) {
            navigator.sendBeacon(kosherStories.ajax_url, body);
            return;
        }

        fetch(kosherStories.ajax_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        }).catch(() => {
            analyticsQueue = events.concat(analyticsQueue).slice(0, 40);
        });
    }

    function queueDropoffFromState() {
        const storyState = storyBody._kaycoStoryState;

        if (!storyState || storyState.completed) {
            return;
        }

        const postId = storyState.postIds[storyState.current];
        if (!postId) {
            return;
        }

        queueStoryEvent({
            eventType: 'dropoff',
            postId,
            termId: storyState.termId,
            slideIndex: storyState.current,
            totalSlides: storyState.totalSlides,
            duration: storyState.activeDuration || 0
        });

        storyState.completed = true;
        flushStoryEvents(true);
    }

    function getDefaultThumbSrc() {
        return kosherStories.default_thumb_url || '';
    }

    function getStoryThumbSrc(story) {
        if (story && story.img) {
            return story.img;
        }

        return getDefaultThumbSrc();
    }

    function resetAllVideos() {
    document.querySelectorAll('#kosher-stories video').forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
}

function stopAllStoryMedia() {

    // 🔴 STOP ALL VIDEOS (both normal + bg)
    document.querySelectorAll('#kosher-stories-viewer video').forEach(video => {
        video.onloadedmetadata = null;
        video.onloadeddata = null;
        video.pause();
        video.currentTime = 0;

        video.querySelectorAll('source').forEach(source => {
            source.removeAttribute('src');
        });

        video.removeAttribute('src');
        video.load();
    });

    // ⏱️ CLEAR ALL TIMERS (VERY IMPORTANT)
    document.querySelectorAll('.kosher-stories-content, .kosher-stories-body').forEach(wrapper => {
        if (wrapper._timer) {
            clearTimeout(wrapper._timer);
            wrapper._timer = null;
        }
    });

}

function playActiveVideo(activeSlide) {

    const video = activeSlide.querySelector('video');

    if (!video) return;

    video.currentTime = 0;

    const playPromise = video.play();

    if (playPromise !== undefined) {
        playPromise.catch(err => {
            console.warn('Autoplay blocked:', err);
        });
    }
}

    // =========================
    // 📊 TRACK VIEW
    // =========================
    function trackView(postId, termId, duration) {
        fetch(kosherStories.ajax_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'kosher_track_story_view',
                post_id: postId,
                term_id: termId,
                duration: duration
            })
        });
    }

    function getPollConfig() {
        return {
            ajaxUrl: (window.kaycoPolls && window.kaycoPolls.ajaxUrl) || kosherStories.ajax_url,
            nonce: (window.kaycoPolls && window.kaycoPolls.nonce) || kosherStories.poll_nonce || '',
            messages: (window.kaycoPolls && window.kaycoPolls.messages) || {}
        };
    }

    function formatPollNumber(value) {
        return new Intl.NumberFormat().format(value || 0);
    }

    function createPollVoterMarkup(voter) {
        return `
            <div class="kayco-poll-voter">
                ${voter.avatar ? `<img src="${voter.avatar}" alt="${voter.name}" loading="lazy" />` : ''}
                <div class="kayco-poll-voter__copy">
                    <strong>${voter.name}</strong>
                    ${voter.voted_at ? `<small>${voter.voted_at}</small>` : ''}
                </div>
            </div>
        `;
    }

    function createPollAvatarMarkup(voter) {
        return voter.avatar ? `<img src="${voter.avatar}" alt="${voter.name}" loading="lazy" />` : '';
    }

    function initStoryPollCards(scope) {
        if (!scope) {
            return;
        }

        scope.querySelectorAll('.story-poll .kayco-poll-card').forEach((card) => {
            if (card.dataset.storyPollBound === 'true') {
                card.classList.add('is-visible');
                return;
            }

            card.dataset.storyPollBound = 'true';
            card.classList.add('is-visible');
            attachStoryPollHandlers(card);
            syncStoryPollSelection(card);
        });
    }

    function storyPollCanVote(card) {
        if (card.dataset.canVote) {
            return card.dataset.canVote === 'true';
        }

        return !!card.querySelector('.js-kayco-poll-submit') || !!card.querySelector('.js-kayco-poll-form input[type="radio"]:not([disabled])');
    }

    function attachStoryPollHandlers(card) {
        const form = card.querySelector('.js-kayco-poll-form');
        const toggle = card.querySelector('.js-kayco-poll-view-votes');
        let isSavingChange = false;

        if (toggle) {
            toggle.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();

                const isOpen = toggle.classList.contains('is-open');

                card.querySelectorAll('.kayco-poll-option__voters').forEach((voters) => {
                    voters.toggleAttribute('hidden', isOpen);
                });

                toggle.classList.toggle('is-open', !isOpen);

                const label = toggle.querySelector('span');
                if (label) {
                    label.textContent = isOpen ? 'View votes' : 'Hide votes';
                }
            });
        }

        card.querySelectorAll('input[type="radio"]').forEach((input) => {
            input.addEventListener('change', async function () {
                syncStoryPollSelection(card);

                if (card.dataset.hasVoted !== 'true' || isSavingChange || !form || !storyPollCanVote(card)) {
                    return;
                }

                const checked = form.querySelector('input[type="radio"]:checked');
                const message = card.querySelector('.js-kayco-poll-message');
                const previousVote = card.dataset.userVote || '';

                if (!checked || checked.value === previousVote) {
                    return;
                }

                isSavingChange = true;

                if (message) {
                    message.textContent = getPollConfig().messages.loading || 'Saving your vote...';
                }

                card.querySelectorAll('input[type="radio"]').forEach((field) => {
                    field.disabled = true;
                });

                try {
                    const result = await submitStoryPollVote(card, checked.value);

                    if (result.success && result.data && result.data.payload) {
                        applyStoryPollPayload(card, result.data.payload, result.data.message || getPollConfig().messages.updated);
                        return;
                    }

                    if (result.data && result.data.payload) {
                        applyStoryPollPayload(card, result.data.payload, result.data.message || getPollConfig().messages.error);
                    } else if (message) {
                        message.textContent = (result.data && result.data.message) || getPollConfig().messages.error || 'Something went wrong while saving your vote.';
                    }
                } catch (error) {
                    if (message) {
                        message.textContent = getPollConfig().messages.error || 'Something went wrong while saving your vote.';
                    }
                } finally {
                    isSavingChange = false;
                }
            });
        });

        if (!form) {
            return;
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            event.stopPropagation();

            const checked = form.querySelector('input[type="radio"]:checked');
            const submit = form.querySelector('.js-kayco-poll-submit');
            const message = card.querySelector('.js-kayco-poll-message');

            if (!checked || !submit || submit.disabled) {
                return;
            }

            submit.disabled = true;
            submit.classList.add('is-loading');

            if (message) {
                message.textContent = getPollConfig().messages.loading || 'Saving your vote...';
            }

            try {
                const result = await submitStoryPollVote(card, checked.value);

                if (result.success && result.data && result.data.payload) {
                    applyStoryPollPayload(card, result.data.payload, result.data.message);
                    return;
                }

                if (result.data && result.data.payload) {
                    applyStoryPollPayload(card, result.data.payload, result.data.message || getPollConfig().messages.error);
                } else if (message) {
                    message.textContent = (result.data && result.data.message) || getPollConfig().messages.error || 'Something went wrong while saving your vote.';
                }
            } catch (error) {
                if (message) {
                    message.textContent = getPollConfig().messages.error || 'Something went wrong while saving your vote.';
                }
            } finally {
                submit.classList.remove('is-loading');
                syncStoryPollSelection(card);
            }
        });
    }

    function syncStoryPollSelection(card) {
        const checked = card.querySelector('input[type="radio"]:checked');
        const submit = card.querySelector('.js-kayco-poll-submit');

        card.querySelectorAll('.kayco-poll-option').forEach((option) => {
            const isSelected = !!checked && option.dataset.optionId === checked.value;
            option.classList.toggle('is-selected', isSelected);
            option.dataset.isUserVote = isSelected ? 'true' : 'false';

            const status = option.querySelector('.js-kayco-poll-user-status');
            if (status) {
                status.hidden = !isSelected || card.dataset.hasVoted !== 'true';
            }
        });

        if (submit) {
            const label = submit.querySelector('span');

            if (label) {
                label.textContent = 'Submit Vote';
            }

            submit.hidden = card.dataset.hasVoted === 'true';
            submit.disabled = card.dataset.hasVoted === 'true' || !checked || !storyPollCanVote(card);
        }
    }

    function applyStoryPollPayload(card, payload, message) {
        card.dataset.userVote = payload.userVote || '';
        card.dataset.hasVoted = payload.hasVoted ? 'true' : 'false';
        card.dataset.canVote = payload.canVote ? 'true' : 'false';
        card.classList.add('has-voted');

        const total = card.querySelector('.js-kayco-poll-total');
        if (total) {
            total.textContent = formatPollNumber(payload.totalVotes || 0);
        }

        const messageNode = card.querySelector('.js-kayco-poll-message');
        if (messageNode) {
            messageNode.textContent = message || getPollConfig().messages.updated || getPollConfig().messages.success || 'Your vote is saved.';
        }

        const submit = card.querySelector('.js-kayco-poll-submit');
        if (submit) {
            submit.classList.remove('is-loading');
            submit.hidden = !payload.canVote || payload.hasVoted;
        }

        const viewVotes = card.querySelector('.js-kayco-poll-view-votes');
        if (viewVotes) {
            viewVotes.hidden = false;
            viewVotes.classList.remove('is-open');
            const label = viewVotes.querySelector('span');
            if (label) {
                label.textContent = 'View votes';
            }
        }

        (payload.options || []).forEach((optionData) => {
            const option = card.querySelector(`.kayco-poll-option[data-option-id="${optionData.id}"]`);

            if (!option) {
                return;
            }

            const input = option.querySelector('input[type="radio"]');
            if (input) {
                input.checked = !!optionData.isUserVote;
                input.disabled = !payload.canVote;
            }

            option.classList.toggle('is-selected', !!optionData.isUserVote);
            option.dataset.isUserVote = optionData.isUserVote ? 'true' : 'false';

            const status = option.querySelector('.js-kayco-poll-user-status');
            if (status) {
                status.hidden = !optionData.isUserVote;
            }

            const percentNode = option.querySelector('.js-kayco-poll-percent');
            if (percentNode) {
                percentNode.textContent = `${optionData.percent}%`;
            }

            const countLabel = option.querySelector('.js-kayco-poll-count-label');
            if (countLabel) {
                countLabel.textContent = optionData.countLabel || `${formatPollNumber(optionData.count || 0)} votes`;
            }

            const bar = option.querySelector('.js-kayco-poll-bar');
            if (bar) {
                bar.style.width = `${optionData.percent}%`;
            }

            const avatars = option.querySelector('.kayco-poll-option__avatars');
            if (avatars) {
                avatars.innerHTML = (optionData.avatarStack || []).map(createPollAvatarMarkup).join('');
            }

            const voters = option.querySelector('.kayco-poll-option__voters');
            if (voters) {
                voters.innerHTML = (optionData.voters || []).map(createPollVoterMarkup).join('');
                voters.setAttribute('hidden', '');
            }
        });

        syncStoryPollSelection(card);
    }

    function submitStoryPollVote(card, optionValue) {
        const config = getPollConfig();
        const body = new URLSearchParams({
            action: 'kayco_submit_poll_vote',
            nonce: config.nonce,
            poll_id: card.dataset.pollId || '',
            poll_option: optionValue
        });

        return fetch(config.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: body.toString()
        }).then((response) => response.json());
    }

    window.addEventListener('beforeunload', function () {
        queueDropoffFromState();
        flushStoryEvents(true);
    });

function updateThumbFromServer(termId) {

    fetch(kosherStories.ajax_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action: 'kosher_get_story_thumb',
            term_id: termId,
            t: Date.now()
        })
    })
    .then(res => res.json())
    .then(data => {

        if (!data.success) return;

        const stories = Array.isArray(data.data) ? data.data : [];

        if (!stories.length) {
            return;
        }

        const seenData = getSeenData();
        const seenPosts = (seenData[termId]?.posts || []).map(String);
        const seenSet = new Set(seenPosts);

        let target = null;

        // 🔥 FIRST unseen
        for (let story of stories) {
            if (!seenSet.has(String(story.id))) {
                target = story;
                break;
            }
        }

        // fallback → first story
        if (!target) target = stories[0];

        const thumb = document.querySelector(`.kosher-story-thumb[data-term="${termId}"]`);
        if (!thumb) return;

        const inner = thumb.querySelector('.thumb-inner');
        if (!inner) return;

        const thumbSrc = getStoryThumbSrc(target);
        if (!thumbSrc) return;

        const img = new Image();
        img.src = thumbSrc;

        img.onload = () => {
            inner.innerHTML = '';
            inner.appendChild(img);
        };

    });
}

    function preloadAllThumbs() {

    categories.forEach(el => {

        const termId = el.getAttribute('data-term');

        fetch(kosherStories.ajax_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'kosher_get_story_thumb',
                term_id: termId
            })
        })
        .then(res => res.json())
        .then(data => {

            if (!data.success) return;

            const stories = Array.isArray(data.data) ? data.data : [];
            const target = stories.find(story => story && story.img) || stories[0];
            const thumbSrc = getStoryThumbSrc(target);

            if (!target || !thumbSrc) return;

            const inner = el.querySelector('.thumb-inner');
            if (!inner) return;

            inner.innerHTML = `<img src="${thumbSrc}" alt="">`;
        });

    });

}

    // =========================
    // 👁️ STORAGE
    // =========================
    function getSeenData() {
        return JSON.parse(localStorage.getItem('kosher_story_seen') || '{}');
    }

    function saveSeenData(data) {
        localStorage.setItem('kosher_story_seen', JSON.stringify(data));
    }

    function markStorySeen(termId, postId) {
        const data = getSeenData();

        if (!data[termId]) {
            data[termId] = { posts: [] };
        }

        if (!data[termId].posts.includes(String(postId))) {
            data[termId].posts.push(String(postId));
        }

        saveSeenData(data);
    }

    function markCategorySeen(termId, postIds) {
        const data = getSeenData();
        data[termId] = { posts: postIds.map(id => String(id)) };
        saveSeenData(data);
        updateThumbUI(termId, true);
    }

    function updateThumbUI(termId, seen) {
        const el = document.querySelector(`.kosher-story-thumb[data-term="${termId}"]`);
        if (!el) return;
        seen ? el.classList.add('seen') : el.classList.remove('seen');
    }

    function checkSeenState(termId, postIds) {

        const data = getSeenData();

        if (!data[termId]) {
            updateThumbUI(termId, false);
            return;
        }

        const seenPosts = (data[termId].posts || []).map(String);
        const incoming = postIds.map(id => String(id));

        const seenSet = new Set(seenPosts);

        const hasUnseen = incoming.some(id => !seenSet.has(id));

        if (hasUnseen) {
            updateThumbUI(termId, false);
        } else {
            updateThumbUI(termId, true);
        }
    }

    function initAllThumbsSeenState() {
        const data = getSeenData();

        categories.forEach(el => {
            const termId = el.getAttribute('data-term');
            if (!data[termId]) return;
            updateThumbUI(termId, true);
        });
    }

    initAllThumbsSeenState();
    preloadAllThumbs();
    refreshStoriesState();

    // =========================
    // 🔥 START INDEX LOGIC
    // =========================
    function getStartIndex(postIds, termId) {

        const data = getSeenData();

        if (!data[termId]) return 0;

        const seenPosts = (data[termId].posts || []).map(String);
        const seenSet = new Set(seenPosts);

        // 🔥 FIRST unseen
        for (let i = 0; i < postIds.length; i++) {
            if (!seenSet.has(String(postIds[i]))) {
                return i; // 👈 THIS WILL BE 10
            }
        }

        return 0;
    }

    // =========================
    // 🔥 LIVE REFRESH
    // =========================
function refreshStoriesState() {

    // 🚫 DO NOT OVERRIDE while viewer is open
    if (!viewer.classList.contains('hidden')) {
        return;
    }

    categories.forEach(el => {

        const termId = el.getAttribute('data-term');

        fetch(kosherStories.ajax_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'kosher_get_story_ids',
                term_id: termId
            })
        })
        .then(res => res.json())
        .then(data => {

            if (!data.success) return;

            const postIds = data.data.post_ids;

            const dataSeen = getSeenData();
            const seenPosts = (dataSeen[termId]?.posts || []).map(String);

            const seenSet = new Set(seenPosts);

            const hasUnseen = postIds.some(id => !seenSet.has(String(id)));

            updateThumbUI(termId, !hasUnseen);

            // ✅ ONLY update server thumb when viewer CLOSED
            updateThumbFromServer(termId);

        });

    });
}

    setInterval(refreshStoriesState, 4000);

    // =========================
    // 🖼️ THUMB UPDATE (NEW)
    // =========================
function updateThumbFromSlides(termId) {


    // ⏳ Ensure DOM is ready (important after AJAX render)
    requestAnimationFrame(() => {

        const wrapper = document.querySelector('.kosher-stories-body');

        if (!wrapper) {
            console.error('❌ NO .kosher-stories-content FOUND');
            return;
        }

        const firstSlide = wrapper.querySelector('.slide');

        if (!firstSlide) {
            console.error('❌ NO .slide FOUND');
            return;
        }


        let imgSrc = null;

        // =========================
        // 🖼️ 1. DIRECT IMAGE
        // =========================
        const img = firstSlide.querySelector('img');

        if (img && img.src) {
            imgSrc = img.src;
        }

        // =========================
        // 🎬 2. VIDEO POSTER
        // =========================
        if (!imgSrc) {

            const video = firstSlide.querySelector('video');

            if (video) {

                const poster = video.getAttribute('poster');

                if (poster) {
                    imgSrc = poster;
                } else {
                    console.warn('⚠️ Video has NO poster');
                }
            }
        }

        // =========================
        // 🖼️ 3. BACKGROUND IMAGE (YOUR CASE)
        // =========================
        if (!imgSrc) {

            const bgImg = firstSlide.querySelector('.story-background--image img');

            if (bgImg && bgImg.src) {
                imgSrc = bgImg.src;
            }
        }

        // =========================
        // 🎬 4. VIDEO → TRY FRAME (OPTIONAL SAFE FALLBACK)
        // =========================
        if (!imgSrc) {

            const video = firstSlide.querySelector('video');

            if (video && video.src) {

                console.warn('⚠️ No poster → fallback to video frame');

                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    canvas.width = 300;
                    canvas.height = 200;

                    video.currentTime = 0.1;

                    video.addEventListener('loadeddata', function captureFrame() {

                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                        imgSrc = canvas.toDataURL('image/jpeg');

                        applyThumb(imgSrc);

                        video.removeEventListener('loadeddata', captureFrame);

                    });

                    return; // stop normal flow (async)
                } catch (e) {
                    console.error('❌ Failed to generate video frame', e);
                }
            }
        }

        // =========================
        // ❌ FINAL FALLBACK
        // =========================
        if (!imgSrc) {
            console.warn('❌ No thumbnail source found → using default icon');
            imgSrc = getDefaultThumbSrc();
        }

        if (imgSrc) {
            applyThumb(imgSrc);
        }

        // =========================
        // 🎯 APPLY THUMB
        // =========================
        function applyThumb(src) {


            const wrappers = document.querySelectorAll('.kosher-story-thumb');


            let found = false;

            wrappers.forEach(wrapper => {

                const dataTerm = wrapper.getAttribute('data-term');


                if (String(dataTerm) === String(termId)) {

                    const inner = wrapper.querySelector('.thumb-inner');

                    if (!inner) {
                        console.error('❌ .thumb-inner missing inside:', wrapper);
                        return;
                    }

                    inner.innerHTML = `<img src="${src}" alt="">`;


                    found = true;
                }
            });

            if (!found) {
                console.error('❌ NO MATCHING THUMB FOUND FOR termId:', termId);
            }
        }

    });
}

    function parsePostIds(value) {
        try {
            const ids = JSON.parse(value || '[]');
            return Array.isArray(ids) ? ids : [];
        } catch (error) {
            return [];
        }
    }

    function stopStoryWrapper(wrapper, resetSlides = false) {
        if (!wrapper) {
            return;
        }

        if (wrapper._timer) {
            clearTimeout(wrapper._timer);
            wrapper._timer = null;
        }

        wrapper.querySelectorAll('video').forEach(video => {
            video.onloadedmetadata = null;
            video.onloadeddata = null;

            video.pause();
            video.currentTime = 0;
        });

        if (!resetSlides) {
            return;
        }

        wrapper.querySelectorAll('.slide').forEach((slide, index) => {
            slide.style.display = index === 0 ? 'block' : 'none';
        });

        wrapper.querySelectorAll('.bar').forEach((bar) => {
            const span = bar.querySelector('span');
            bar.classList.remove('seen');

            if (span) {
                span.style.animation = 'none';
                span.style.transform = 'scaleX(0)';
            }
        });
    }

    function loadStoriesCarousel(startIndex = 0) {
        const startThumb = categories[startIndex];
        const startTermId = startThumb ? startThumb.getAttribute('data-term') : '';

        fetch(kosherStories.ajax_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'kosher_get_all_stories_carousel',
                start_term_id: startTermId
            })
        })
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                loadCategory(startIndex);
                return;
            }

            storyBody.innerHTML = data.data.html;
            viewer.classList.add('is-reels-carousel');
            viewer.classList.remove('hidden');
            initReelsCarousel(storyBody, data.data.start_index || 0);
        })
        .catch(() => loadCategory(startIndex));
    }

    function initReelsCarousel(scope, initialIndex = 0, options = {}) {
        const track = scope.querySelector('.kosher-reels__track');
        const shell = scope.querySelector('.kosher-reels') || scope;
        const originalCards = Array.from(scope.querySelectorAll('.kosher-reel-card:not([data-reel-clone])'));
        const prev = scope.querySelector('.kosher-reels__nav--prev');
        const next = scope.querySelector('.kosher-reels__nav--next');

        if (!track || !originalCards.length) {
            return;
        }

        if (originalCards.length > 1 && track.dataset.reelsLoopReady !== 'true') {
            originalCards.forEach((card) => {
                const clone = card.cloneNode(true);
                clone.dataset.reelClone = 'after';
                track.appendChild(clone);
            });

            originalCards.slice().reverse().forEach((card) => {
                const clone = card.cloneNode(true);
                clone.dataset.reelClone = 'before';
                track.insertBefore(clone, track.firstChild);
            });

            track.dataset.reelsLoopReady = 'true';
        }

        const cards = Array.from(scope.querySelectorAll('.kosher-reel-card'));
        const originalCount = originalCards.length;
        const middleOffset = originalCount > 1 ? originalCount : 0;

        let activeIndex = Math.max(0, Math.min(originalCount - 1, initialIndex));
        let activeVisualIndex = middleOffset + activeIndex;
        let activeStarted = false;
        let wheelLocked = false;
        let touchStartX = null;
        let touchStartY = null;

        function syncButtons() {
            if (prev) {
                prev.disabled = originalCount <= 1;
            }

            if (next) {
                next.disabled = originalCount <= 1;
            }
        }

        function normalizeIndex(index) {
            if (!originalCount) {
                return 0;
            }

            return (index % originalCount + originalCount) % originalCount;
        }

        function centerActiveCard(animate = true) {
            const activeCard = cards[activeVisualIndex];
            const offset = activeCard.offsetLeft + (activeCard.offsetWidth / 2);
            track.style.transition = animate ? '' : 'none';
            track.style.transform = `translateX(calc(50% - ${offset}px))`;

            if (!animate) {
                void track.offsetWidth;
                track.style.transition = '';
            }
        }

        function activateCard(index, initialSlideIndex = null, shouldStart = false, allowMutedFallback = false) {
            activeIndex = normalizeIndex(index);
            activeVisualIndex = middleOffset + activeIndex;
            activeStarted = shouldStart;
            shell.classList.toggle('is-playing', activeStarted);

            cards.forEach((card, cardIndex) => {
                const dailyStories = card.querySelector('.daily-stories');
                const isActive = cardIndex === activeVisualIndex;

                card.classList.toggle('is-active', isActive);
                card.setAttribute('aria-hidden', isActive ? 'false' : 'true');
                stopStoryWrapper(dailyStories, true);
            });

            centerActiveCard();
            syncButtons();

            if (!shouldStart) {
                return;
            }

            startActiveCard(initialSlideIndex, allowMutedFallback);
        }

        function startActiveCard(initialSlideIndex = null, allowMutedFallback = false) {
            const activeCard = cards[activeVisualIndex];
            const dailyStories = activeCard.querySelector('.daily-stories');
            const termId = activeCard.getAttribute('data-term');
            const postIds = parsePostIds(activeCard.getAttribute('data-post-ids'));


            currentCategoryIndex = categories.findIndex(category => category.getAttribute('data-term') === termId);
            currentTermId = termId;

            if (postIds.length) {
                checkSeenState(termId, postIds);
            }

            initStoryEngine(dailyStories, postIds, termId, initialSlideIndex, {
                carousel: true,
                allowMutedFallback,
                onComplete: function () {
                    markCategorySeen(termId, postIds);
                    // moveCarousel(1, null, true);
                },
                onPreviousCategory: function () {
                    moveCarousel(-1, 'last', true);
                }
            });

            activeStarted = true;
            shell.classList.add('is-playing');
        }

        function moveCarousel(direction, initialSlideIndex = null, allowMutedFallback = false) {


            if (originalCount <= 1) {
                startActiveCard(null, allowMutedFallback);
                return;
            }

            activateCard(activeIndex + direction, initialSlideIndex, true, allowMutedFallback);

        }

        cards.forEach((card, index) => {
            card.addEventListener('click', function (event) {
                if (
                    event.target.closest('.prev-slide') ||
                    event.target.closest('.next-slide') ||
                    event.target.closest('.story-poll') ||
                    event.target.closest('.overlay a')
                ) {
                    return;
                }

                if (index === activeVisualIndex) {
                    if (!activeStarted) {
                        startActiveCard();
                    }
                    return;
                }

                activateCard(normalizeIndex(index - middleOffset), null, true);
            });
        });

        if (prev) {
            prev.addEventListener('click', function () {

                moveCarousel(-1, 'last');
            });
        }

        if (next) {
            next.addEventListener('click', function () {

                moveCarousel(1);
            });
        }

        scope.addEventListener('wheel', function (event) {
            if (wheelLocked || Math.abs(event.deltaX) + Math.abs(event.deltaY) < 24) {
                return;
            }

            event.preventDefault();
            wheelLocked = true;
            moveCarousel(event.deltaX + event.deltaY > 0 ? 1 : -1, null, true);
            setTimeout(() => {
                wheelLocked = false;
            }, 420);
        }, { passive: false });

        scope.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1) {
                touchStartX = null;
                touchStartY = null;
                return;
            }

            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
        }, { passive: true });

        scope.addEventListener('touchend', function (event) {
            if (touchStartX === null || touchStartY === null) {
                return;
            }

            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            touchStartX = null;
            touchStartY = null;

            if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) {
                return;
            }

            moveCarousel(deltaX < 0 ? 1 : -1, null, true);
        }, { passive: true });

        if (scope._reelsResizeHandler) {
            window.removeEventListener('resize', scope._reelsResizeHandler);
        }

        scope._reelsResizeHandler = centerActiveCard;
        window.addEventListener('resize', scope._reelsResizeHandler, { passive: true });
        activateCard(activeIndex, null, options.autoplay === true);
    }

    // =========================
    // LOAD CATEGORY
    // =========================
    function loadCategory(index, options = {}) {

        if (!categories[index]) {
            viewer.classList.add('hidden');
            storyBody.innerHTML = '';
            return;
        }

        currentCategoryIndex = index;
        const termId = categories[index].getAttribute('data-term');
        currentTermId = termId;
        viewer.classList.remove('is-reels-carousel');

        fetch(kosherStories.ajax_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                action: 'kosher_get_category_stories',
                term_id: termId
            })
        })
        .then(res => res.json())
.then(data => {

    if (!data.success) {
        loadCategory(index + 1);
        return;
    }

    storyBody.innerHTML = data.data.html;
    viewer.classList.remove('hidden');

    // 🔥 FIXED TIMING
setTimeout(() => {
    updateThumbFromSlides(termId);
}, 50);

    initStoryEngine(storyBody, data.data.post_ids, termId, options.initialSlideIndex);

    if (data.data.post_ids) {
        checkSeenState(termId, data.data.post_ids);
    }
})
        .catch(() => loadCategory(index + 1));
    }

    categories.forEach((el, i) => {
        el.addEventListener('click', () => loadStoriesCarousel(i));
    });

    document.querySelectorAll('[data-kosher-stories-inline]').forEach((inlineCarousel) => {
        initReelsCarousel(inlineCarousel, 0, { autoplay: false });
    });

    function closeViewer() {
        queueDropoffFromState();
        stopAllStoryMedia();
        if (storyBody._reelsResizeHandler) {
            window.removeEventListener('resize', storyBody._reelsResizeHandler);
            storyBody._reelsResizeHandler = null;
        }
        viewer.classList.add('hidden');
        viewer.classList.remove('is-reels-carousel');
        storyBody.innerHTML = '';
        refreshStoriesState();
    }

    if (close) {
        close.addEventListener('click', closeViewer);
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !viewer.classList.contains('hidden')) {
            closeViewer();
        }
    });

    // =========================
    // 🎬 STORY ENGINE
    // =========================
    window.initStoryEngine = function(wrapper, postIds, termId, initialSlideIndex = null, options = {}) {

        if (wrapper._timer) {
            clearTimeout(wrapper._timer);
            wrapper._timer = null;
        }

        const slides = wrapper.querySelectorAll('.slide');
        const bars = wrapper.querySelectorAll('.bar');
        const progressBars = wrapper.querySelector('.progress-bars');
        const prevArrow = wrapper.querySelector('.prev-slide');
        const nextArrow = wrapper.querySelector('.next-slide');

        if (!slides.length) return;

        let current = resolveInitialSlideIndex(postIds, termId, initialSlideIndex, slides.length);
        let isTransitioning = false;
        let isPaused = false;
        let remainingTime = 0;
        let activeDuration = 0;
        let slideStartedAt = 0;
        let preventClickAfterTouch = false;
        let touchStartX = null;
        let touchStartY = null;
        let touchStartTarget = null;
        wrapper._kaycoStoryState = {
            termId,
            postIds,
            current,
            totalSlides: slides.length,
            activeDuration: 0,
            completed: false
        };
        storyBody._kaycoStoryState = wrapper._kaycoStoryState;

function moveTo(index) {

    slides.forEach((slide, i) => {

        const video = slide.querySelector('video');
        const bgVideo = slide.querySelector('.story-bg-video');

        // 🎯 HIDE/SHOW
        slide.style.display = i === index ? 'block' : 'none';

        // Stop inactive slides only. The active slide is controlled by the play path.
        if (video && i !== index) {

            video.pause();
            video.currentTime = 0;
        }

        if (bgVideo && i !== index) {

            bgVideo.pause();
            bgVideo.currentTime = 0;
        }

        // Playback starts after the focused slide is visible.
    });
}

        function clearStoryTimer() {
            if (wrapper._timer) {
                clearTimeout(wrapper._timer);
                wrapper._timer = null;
            }
        }

        function getActiveSlide() {
            return slides[current] || null;
        }

        function activeSlideHasPoll() {
            const slide = getActiveSlide();
            return !!(slide && (slide.dataset.hasPoll === 'true' || slide.querySelector('.story-poll')));
        }

        function getActiveProgressBar() {
            const bar = bars[current];
            return bar ? bar.querySelector('span') : null;
        }

        function getActiveVideos() {
            const slide = getActiveSlide();
            return slide ? Array.from(slide.querySelectorAll('video')) : [];
        }

        function keepCarouselVideoPlaying(video) {
            if (!options.carousel || !video) {
                return;
            }

            const expectedPostId = postIds[current];

            [250, 800, 1500].forEach((delay) => {
                setTimeout(() => {
                    const stillActive = wrapper._kaycoStoryState &&
                        wrapper._kaycoStoryState.current === current &&
                        postIds[current] === expectedPostId;

                    if (!stillActive || video.ended || !video.paused) {
                        return;
                    }


                    video.play().catch((error) => {

                    });
                }, delay);
            });
        }

        function playStoryVideo(video) {
            if (!video) {

                return Promise.reject(new Error('No video element'));
            }

            if (!video.paused && !video.ended) {

                return Promise.resolve(true);
            }

            if (options.allowMutedFallback) {
                video.muted = true;
            }


            const playPromise = video.play();

            if (playPromise !== undefined) {
                return playPromise.then(() => {

                    setTimeout(() => {

                    }, 800);
                    keepCarouselVideoPlaying(video);
                    return true;
                }).catch((error) => {

                    if (options.allowMutedFallback) {
                        video.muted = true;
                        video.play().then(() => {

                        }).catch((retryError) => {

                            clearStoryTimer();
                            isPaused = true;
                            setProgressAnimationState('paused');
                            throw retryError;
                        });
                    }

                    clearStoryTimer();
                    isPaused = true;
                    setProgressAnimationState('paused');
                    throw error;
                });
            }

            return Promise.resolve(true);
        }

        function setProgressAnimationState(state) {
            const progressBar = getActiveProgressBar();

            if (progressBar) {
                progressBar.style.animationPlayState = state;
            }
        }

        function setPollSlideMode(enabled) {
            wrapper.classList.toggle('is-poll-slide', enabled);

            if (progressBars) {
                progressBars.toggleAttribute('hidden', enabled);
            }
        }

        function pauseActiveMedia() {
            getActiveVideos().forEach(video => {

                video.pause();
            });
        }

        function resumeActiveMedia() {
            getActiveVideos().forEach(video => {
                playStoryVideo(video);
            });
        }

        function startStoryTimer(duration) {
            activeDuration = duration;
            remainingTime = duration;
            slideStartedAt = Date.now();

            clearStoryTimer();

            wrapper._timer = setTimeout(() => {
                wrapper._timer = null;
                playSlide(current + 1);
            }, duration);
        }

        function pauseStoryPlayback() {
            if (activeSlideHasPoll()) {
                pauseActiveMedia();
                return;
            }

            if (isPaused) {
                return;
            }

            const slide = getActiveSlide();
            if (!slide) {
                return;
            }

            isPaused = true;

            if (activeDuration > 0) {
                const elapsed = Date.now() - slideStartedAt;
                remainingTime = Math.max(0, activeDuration - elapsed);
            }

            clearStoryTimer();
            pauseActiveMedia();
            setProgressAnimationState('paused');
        }

        function resumeStoryPlayback() {
            if (activeSlideHasPoll()) {
                resumeActiveMedia();
                return;
            }

            if (!isPaused) {
                return;
            }

            if (remainingTime <= 0) {
                isPaused = false;
                playSlide(current + 1);
                return;
            }

            isPaused = false;
            slideStartedAt = Date.now();

            clearStoryTimer();
            resumeActiveMedia();
            setProgressAnimationState('running');

            wrapper._timer = setTimeout(() => {
                wrapper._timer = null;
                playSlide(current + 1);
            }, remainingTime);
        }

        function toggleStoryPlayback() {
            if (isPaused) {
                resumeStoryPlayback();
            } else {
                pauseStoryPlayback();
            }
        }

        function setBars(i, duration) {
            bars.forEach((bar, index) => {
                const span = bar.querySelector('span');

                span.style.animation = 'none';
                span.style.transform = 'scaleX(0)';

                bar.classList.remove('seen');

                void span.offsetWidth;

                if (index < i) {
                    span.style.transform = 'scaleX(1)';
                    bar.classList.add('seen');
                }

                if (index === i) {
                    span.style.animation = `progress ${duration}ms linear forwards`;
                    span.style.animationPlayState = 'running';
                }
            });
        }

        function resetVideos(targetIndex = current) {
            slides.forEach((s, index) => {
                const v = s.querySelector('video');
                if (v && index !== targetIndex) {

                    v.pause();
                    v.currentTime = 0;
                }
            });
        }

        function playSlide(i) {

            if (isTransitioning) return;

            isTransitioning = true;
            setTimeout(() => isTransitioning = false, 80);

            if (i >= slides.length || i < 0) {

                if (termId) {
                    markCategorySeen(termId, postIds);
                }

                if (i >= slides.length && postIds[current]) {
                    wrapper._kaycoStoryState.completed = true;
                    queueStoryEvent({
                        eventType: 'complete',
                        postId: postIds[current],
                        termId,
                        slideIndex: current,
                        totalSlides: slides.length,
                        duration: activeDuration || 0
                    });
                    flushStoryEvents();
                }

                if (options.carousel && typeof options.onComplete === 'function') {
                    options.onComplete();
                    return;
                }

                loadCategory(currentCategoryIndex + 1);
                return;
            }

            clearStoryTimer();

            current = i;
            wrapper._kaycoStoryState.current = current;
            wrapper._kaycoStoryState.completed = false;
            isPaused = false;
            remainingTime = 0;
            activeDuration = 0;
            slideStartedAt = 0;

            resetVideos(i);

            const slide = slides[current];
            const video = slide.querySelector('video');
            const bgVideo = slide.querySelector('.story-bg-video');
            const hasPoll = slide.dataset.hasPoll === 'true' || !!slide.querySelector('.story-poll');

            let duration = parseInt(slide.dataset.timeout) || 3000;

            initStoryPollCards(slide);
            setPollSlideMode(hasPoll);


            // =========================
            // 🎬 BACKGROUND VIDEO
            // =========================
if (bgVideo) {

    bgVideo.muted = hasPoll || options.allowMutedFallback ? true : bgVideo.hasAttribute('muted');
    bgVideo.currentTime = 0;

    const startVideo = () => {
        return playStoryVideo(bgVideo);
    };

    const handleDuration = () => {

        let videoDuration = bgVideo.duration;


        if (
            !videoDuration ||
            isNaN(videoDuration) ||
            videoDuration === Infinity ||
            videoDuration === 0
        ) {
            console.warn('⚠️ BG duration invalid → fallback');
            videoDuration = 3;
        }

        const ms = videoDuration * 1000;


        if (!hasPoll) {
            setBars(current, ms);
        }

        if (termId && postIds[current]) {
            markStorySeen(termId, postIds[current]);
            trackView(postIds[current], termId, hasPoll ? 0 : ms);
            queueStoryEvent({
                eventType: 'view',
                postId: postIds[current],
                termId,
                slideIndex: current,
                totalSlides: slides.length,
                duration: hasPoll ? 0 : ms
            });
        }

        wrapper._kaycoStoryState.activeDuration = hasPoll ? 0 : ms;

        if (!hasPoll) {
            startStoryTimer(ms);
        }
    };

    if (bgVideo.readyState >= 1) {
        moveTo(current);
        startVideo().then(() => {
            handleDuration();
            if (isPaused) {
                pauseStoryPlayback();
            }
        }).catch(() => {});
    } else {
        moveTo(current);
        const bgPlayPromise = startVideo();
        bgVideo.onloadedmetadata = () => {
            bgPlayPromise.then(() => {
                handleDuration();
                if (isPaused) {
                    pauseStoryPlayback();
                }
            }).catch(() => {});
        };
    }

    return;
}

            // =========================
            // 🎬 NORMAL VIDEO
            // =========================
if (video) {


    video.muted = !!options.allowMutedFallback;
    video.currentTime = 0;

    const startVideo = () => {
        return playStoryVideo(video);
    };

    const handleDuration = () => {

        let videoDuration = video.duration;


        if (
            videoDuration &&
            !isNaN(videoDuration) &&
            videoDuration !== Infinity &&
            videoDuration > 0
        ) {
            duration = videoDuration * 1000;


        } else {

            console.warn('⚠️ Invalid video duration → fallback to dataset');

            duration = parseInt(slide.dataset.timeout) || 3000;
        }

        if (!hasPoll) {
            setBars(current, duration);
        }


        if (termId && postIds[current]) {
            markStorySeen(termId, postIds[current]);
            trackView(postIds[current], termId, hasPoll ? 0 : duration);
            queueStoryEvent({
                eventType: 'view',
                postId: postIds[current],
                termId,
                slideIndex: current,
                totalSlides: slides.length,
                duration: hasPoll ? 0 : duration
            });
        }

        wrapper._kaycoStoryState.activeDuration = hasPoll ? 0 : duration;
        if (!hasPoll) {
            startStoryTimer(duration);
        }
    };

    // 🔥 CRITICAL: wait for metadata (THIS is why you see 3000ms)
    if (video.readyState >= 1) {
        moveTo(current);
        startVideo().then(() => {
            handleDuration();
            if (isPaused) {
                pauseStoryPlayback();
            }
        }).catch(() => {});
    } else {
        moveTo(current);
        const playPromise = startVideo();
        video.onloadedmetadata = () => {
            playPromise.then(() => {
                handleDuration();
                if (isPaused) {
                    pauseStoryPlayback();
                }
            }).catch(() => {});
        };
    }

    return; // ⛔ STOP here so dataset logic never runs
} else {
            }

            // =========================
            // 📊 APPLY BAR
            // =========================
            moveTo(current);
            if (!hasPoll) {
                setBars(current, duration);
            }


            if (termId && postIds[current]) {
                markStorySeen(termId, postIds[current]);
                trackView(postIds[current], termId, hasPoll ? 0 : duration);
                queueStoryEvent({
                    eventType: 'view',
                    postId: postIds[current],
                    termId,
                    slideIndex: current,
                    totalSlides: slides.length,
                    duration: hasPoll ? 0 : duration
                });
            }

            wrapper._kaycoStoryState.activeDuration = hasPoll ? 0 : duration;
            if (!hasPoll) {
                startStoryTimer(duration);
            }
        }

        function next() {
            playSlide(current + 1);
        }

        function prev() {
            if (current === 0) {
                if (options.carousel && typeof options.onPreviousCategory === 'function') {
                    options.onPreviousCategory();
                    return;
                }

                if (currentCategoryIndex === 0) {
                    return;
                }

                loadCategory(currentCategoryIndex - 1, { initialSlideIndex: 'last' });
                return;
            }

            playSlide(current - 1);
        }

        function openStoryLink(link) {
            const href = link.getAttribute('href');

            if (!href) {
                return;
            }

            window.open(href, '_blank', 'noopener,noreferrer');
        }

        function queueInteractionEvent(event) {
            const postId = postIds[current];
            const rect = wrapper.getBoundingClientRect();

            if (!postId || !rect.width || !rect.height) {
                return;
            }

            const xPercent = ((event.clientX - rect.left) / rect.width) * 100;
            const yPercent = ((event.clientY - rect.top) / rect.height) * 100;
            const element = event.target.closest('.story-el');

            queueStoryEvent({
                eventType: 'heatmap',
                postId,
                termId,
                slideIndex: current,
                totalSlides: slides.length,
                xPercent,
                yPercent
            });

            if (element) {
                queueStoryEvent({
                    eventType: 'click',
                    postId,
                    termId,
                    slideIndex: current,
                    totalSlides: slides.length,
                    elementId: element.getAttribute('data-element-id') || '',
                    elementType: element.getAttribute('data-element-type') || '',
                    xPercent,
                    yPercent
                });
            }
        }

        wrapper.onclick = function(e) {
            if (preventClickAfterTouch) {
                preventClickAfterTouch = false;
                return;
            }

            if (
                e.target.closest('.bar') ||
                e.target.closest('.prev-slide') ||
                e.target.closest('.next-slide')
            ) {
                return;
            }

            queueInteractionEvent(e);

            const link = e.target.closest('.overlay a');

            if (link) {
                e.preventDefault();
                e.stopPropagation();
                openStoryLink(link);
                return;
            }

            if (e.target.closest('.story-poll')) {
                return;
            }

            if (activeSlideHasPoll()) {
                return;
            }

            toggleStoryPlayback();
        };

        if (prevArrow) {
            prevArrow.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                prev();
            };
        }

        if (nextArrow) {
            nextArrow.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                next();
            };
        }

        wrapper.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1) {
                touchStartX = null;
                touchStartY = null;
                touchStartTarget = null;
                return;
            }

            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            touchStartTarget = event.target;
        }, { passive: true });

        wrapper.addEventListener('touchend', function (event) {
            if (touchStartX === null || !touchStartTarget) {
                return;
            }

            if (
                touchStartTarget.closest('.overlay a') ||
                touchStartTarget.closest('.story-poll') ||
                touchStartTarget.closest('.bar') ||
                touchStartTarget.closest('.prev-slide') ||
                touchStartTarget.closest('.next-slide')
            ) {
                touchStartX = null;
                touchStartY = null;
                touchStartTarget = null;
                return;
            }

            const changedTouch = event.changedTouches[0];
            const originalTouchTarget = touchStartTarget;

            if (!changedTouch) {
                touchStartX = null;
                touchStartY = null;
                touchStartTarget = null;
                return;
            }

            const deltaX = changedTouch.clientX - touchStartX;
            const deltaY = changedTouch.clientY - touchStartY;
            const swipeThreshold = 40;
            const tapThreshold = 10;

            touchStartX = null;
            touchStartY = null;
            touchStartTarget = null;

            if (Math.abs(deltaX) <= tapThreshold && Math.abs(deltaY) <= tapThreshold) {
                if (activeSlideHasPoll()) {
                    return;
                }
                preventClickAfterTouch = true;
                queueInteractionEvent({
                    clientX: changedTouch.clientX,
                    clientY: changedTouch.clientY,
                    target: originalTouchTarget
                });
                toggleStoryPlayback();
                return;
            }

            if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY)) {
                return;
            }

            preventClickAfterTouch = true;

            if (deltaX < 0) {
                next();
            } else {
                prev();
            }
        }, { passive: true });

        bars.forEach((bar, i) => {
            bar.onclick = function(e) {
                e.stopPropagation();
                playSlide(i);
            };
        });

        playSlide(current);
    };

    function resolveInitialSlideIndex(postIds, termId, initialSlideIndex, slideCount) {
        if (initialSlideIndex === 'last') {
            return Math.max(0, slideCount - 1);
        }

        if (typeof initialSlideIndex === 'number' && !Number.isNaN(initialSlideIndex)) {
            return Math.max(0, Math.min(slideCount - 1, initialSlideIndex));
        }

        return getStartIndex(postIds, termId);
    }

});
