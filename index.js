require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Enable CORS for all origins
app.use(cors());

// Increase payload size limit for larger forms
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Root route - simple message
app.get('/', (req, res) => {
    res.json({ 
        message: 'Buurenberg Contact API is running',
        endpoints: {
            health: '/health',
            hubspotProxy: '/api/hubspot-proxy'
        }
    });
});

// HubSpot API configuration
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';

// Map form values to HubSpot values
const interestMapping = {
    'appartement': 'Appartement',
    'penthouse': 'Penthouse',
    'kangoeroewoning': 'Kangoeroewoning',
    'assistentiewoning': 'Assistentiewoning',
    'commerciele_ruimte': 'Commerciële ruimte'
};

// Proxy endpoint that can receive form data from any origin
app.post('/api/hubspot-proxy', async (req, res) => {
    try {
        // Log the incoming request data
        console.log('Received form data:', req.body);

        const { 
            firstname, 
            lastname, 
            email, 
            phone, 
            interest, 
            message, 
            newsletter,
            // Add any other fields that might come from the form
            ...otherFields 
        } = req.body;

        // Validate required fields
        if (!firstname || !lastname || !email) {
            return res.status(400).json({ 
                error: 'First name, last name, and email are required',
                received: req.body 
            });
        }

        // First, try to find existing contact by email
        const searchResponse = await axios.post(
            'https://api.hubapi.com/crm/v3/objects/contacts/search',
            {
                filterGroups: [{
                    filters: [{
                        propertyName: 'email',
                        operator: 'EQ',
                        value: email
                    }]
                }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let contactId;
        if (searchResponse.data.total > 0) {
            // Contact exists, use its ID
            contactId = searchResponse.data.results[0].id;
            console.log('Found existing contact:', contactId);
        } else {
            // Create new contact
            const createContactData = {
                properties: {
                    firstname,
                    lastname,
                    email,
                    phone: phone || '',
                }
            };

            const createResponse = await axios.post(HUBSPOT_API_URL, createContactData, {
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            contactId = createResponse.data.id;
            console.log('Created new contact:', contactId);
        }

        // Map interests to HubSpot values and update the contact
        const mappedInterests = interest ? interest.map(i => interestMapping[i]).filter(Boolean) : [];
        
        // Convert newsletter value to boolean string
        const newsletterValue = newsletter === true || newsletter === 'true' ? 'true' : 'false';
        console.log('Newsletter value being sent to HubSpot:', newsletterValue);

        const updateContactData = {
            properties: {
                firstname,
                lastname,
                phone: phone || '',
                interesses: mappedInterests.join(';'),
                message: message || '',
                nieuwsbrief: newsletterValue,
                // Include any other fields that might be relevant
                ...otherFields
            }
        };

        await axios.patch(`${HUBSPOT_API_URL}/${contactId}`, updateContactData, {
            headers: {
                'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({ 
            success: true, 
            message: 'Contact updated successfully',
            contactId: contactId
        });
    } catch (error) {
        console.error('Error creating/updating HubSpot contact:', error);
        // Log the full error details
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers
        });
        
        res.status(500).json({ 
            error: 'Failed to create/update contact',
            details: error.response?.data?.message || error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'The requested endpoint does not exist'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('HubSpot API Key configured:', HUBSPOT_API_KEY ? 'Yes' : 'No');
});
