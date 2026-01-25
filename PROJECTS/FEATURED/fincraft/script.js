document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('newsletterForm');
    
    if(form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const emailInput = form.querySelector('input[type="email"]');
            const button = form.querySelector('button');
            const originalText = button.textContent;
            
            if(emailInput.value) {
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

    // Optional: Clone testimonial items dynamically to ensure smoother loop if needed
    // Currently handled by manual duplication in HTML for simplicity
});
