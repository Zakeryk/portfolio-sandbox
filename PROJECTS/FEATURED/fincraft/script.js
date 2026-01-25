document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('newsletterForm');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const emailInput = form.querySelector('input[type="email"]');
            const button = form.querySelector('button');
            const originalText = button.textContent;

            if (emailInput.value) {
                // Simulate loading/success
                button.textContent = 'Subscribing...';
                button.disabled = true;

                setTimeout(() => {
                    button.textContent = 'Subscribed!';
                    button.style.backgroundColor = '#27ae60'; // Success green
                    button.style.color = 'white';
                    emailInput.value = '';

                    setTimeout(() => {
                        // Reset after a few seconds
                        button.textContent = originalText;
                        button.disabled = false;
                        button.style.backgroundColor = '';
                        button.style.color = '';
                    }, 3000);
                }, 1000);
            }
        });
    }

    // Dynamic Reviews Loading
    if (typeof reviewsData !== 'undefined') {
        const trackLeft = document.getElementById('track-left');
        const trackRight = document.getElementById('track-right');
        const reviewsGrid = document.getElementById('reviews-grid');

        function createCard(review) {
            const card = document.createElement('div');
            card.className = 'testimonial-card';
            card.innerHTML = `<p>"${review.text}"</p><span class="author">— ${review.author}</span>`;
            return card;
        }

        // 1. Home Page Marquee Logic
        if (trackLeft && trackRight) {
            const homeReviews = reviewsData.slice(0, 10);
            const mid = Math.ceil(homeReviews.length / 2);
            const leftReviews = homeReviews.slice(0, mid);
            const rightReviews = homeReviews.slice(mid);

            function populateTrack(track, reviews) {
                reviews.forEach(review => track.appendChild(createCard(review)));
                reviews.forEach(review => track.appendChild(createCard(review)));
                reviews.forEach(review => track.appendChild(createCard(review)));
            }

            populateTrack(trackLeft, leftReviews);
            populateTrack(trackRight, rightReviews);
        }

        // 2. Reviews Page Grid Logic
        if (reviewsGrid) {
            reviewsData.forEach(review => reviewsGrid.appendChild(createCard(review)));
        }
    }
});
