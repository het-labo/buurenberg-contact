(function() {
    // Wait for the DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', function() {
        const script = document.getElementById('hubspot-form-handler');
        if (!script) {
            console.error('HubSpot form handler script not found');
            return;
        }

        const formId = script.getAttribute('data-form-id');
        const apiUrl = script.getAttribute('data-api-url');

        if (!formId || !apiUrl) {
            console.error('Missing required attributes: data-form-id and data-api-url');
            return;
        }

        const form = document.getElementById(formId);
        if (!form) {
            console.error(`Form with ID "${formId}" not found`);
            return;
        }

        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            
            try {
                // Disable submit button and show loading state
                submitButton.disabled = true;
                submitButton.textContent = 'Bezig met verzenden...';
                
                const formData = new FormData(form);
                
                // Convert FormData to object
                const data = {
                    firstname: formData.get('firstname'),
                    lastname: formData.get('lastname'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    interest: formData.getAll('interest[]'),
                    message: formData.get('message'),
                    newsletter: formData.get('newsletter') === 'true'
                };

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error(`Server returned non-JSON response: ${contentType}`);
                }

                const result = await response.json();
                
                if (response.ok) {
                    alert('Bedankt voor uw interesse!');
                    form.reset();
                } else {
                    throw new Error(result.error || result.details || 'Er is iets misgegaan');
                }
            } catch (error) {
                console.error('Form submission error:', error);
                alert('Er is een fout opgetreden: ' + error.message);
            } finally {
                // Reset button state
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    });
})(); 