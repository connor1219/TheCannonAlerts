# TheCannon Alerts

A notification service for [TheCannon](https://thecannon.ca/) housing listings in Guelph, Ontario. Get instant alerts via email or Discord webhook when new rental listings match your bedroom and price preferences.

## Overview

TheCannon Alerts automatically monitors TheCannon's housing board for new rental listings and sends notifications to subscribers based on their filtering preferences. Users can subscribe to receive alerts for specific bedroom counts and price ranges, making it easier to find housing in a competitive rental market.

## Key Features

- **Real-time Notifications**: Automatically checks for new listings every 5 minutes
- **Flexible Delivery**: Receive alerts via email or Discord webhook
- **Customizable Filters**: Filter by bedroom count (1-5+) and price range ($0-$1500+)
- **Beautiful Emails**: React Email templates with listing details, images, and direct links
- **Easy Unsubscribe**: One-click unsubscribe from any notification
- **Statistics Dashboard**: Live counts of active subscribers and total notifications sent

## Tech Stack

### Frontend
- **Next.js 16** with React 19
- **Material UI (MUI) 7** for component library
- **React Hook Form** with **Zod** validation
- **TypeScript**

### Backend
- **Firebase Functions** (Python 3.13) for core business logic
- **Firebase Functions** (Node.js 20) for email rendering
- **Cloud Firestore** for data persistence
- **React Email** for email template rendering

### Infrastructure
- **Firebase Hosting** for frontend deployment
- **Mailgun** for email delivery
- **GitHub Actions** for CI/CD

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────┐
│    Frontend     │     │           Firebase Functions             │
│   (Next.js)     │────▶│                                          │
│                 │     │  ┌─────────────────────────────────────┐ │
└─────────────────┘     │  │  Python Functions                   │ │
                        │  │  - create_subscription              │ │
                        │  │  - unsubscribe                      │ │
                        │  │  - get_stats                        │ │
                        │  │  - ingest_listings (HTTP + cron)    │ │
                        │  │  - scheduled_listing_ingestion      │ │
                        │  └─────────────────────────────────────┘ │
                        │                                          │
                        │  ┌─────────────────────────────────────┐ │
                        │  │  Node.js Functions                  │ │
                        │  │  - renderEmail (React Email)        │ │
                        │  └─────────────────────────────────────┘ │
                        └──────────────────────────────────────────┘
                                         │
                        ┌────────────────┼────────────────┐
                        │                │                │
                        ▼                ▼                ▼
                   ┌─────────┐    ┌───────────┐    ┌───────────┐
                   │Firestore│    │  Mailgun  │    │  Discord  │
                   │         │    │   (Email) │    │ (Webhook) │
                   └─────────┘    └───────────┘    └───────────┘
```

**Data Flow:**
1. Scheduler triggers `scheduled_listing_ingestion` every 5 minutes
2. Function scrapes TheCannon housing page for new listings
3. New listings are stored in Firestore and matched against subscriptions
4. Matching subscribers receive notifications via their preferred method
5. Email notifications are rendered using React Email templates

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.13
- Yarn package manager
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore enabled
- Mailgun account (for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/TheCannonAlerts.git
   cd TheCannonAlerts
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   yarn install
   ```

3. **Install email renderer dependencies**
   ```bash
   cd ../email-render-function
   yarn install
   ```

4. **Set up Python functions**
   ```bash
   cd ../functions
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

5. **Configure Firebase**
   ```bash
   firebase login
   firebase use --add  # Select your Firebase project
   ```

### Environment Variables

Create a `.runtimeconfig.json` file in the `functions/` directory for local development:

```json
{
  "mailgun": {
    "domain": "your-mailgun-domain.com",
    "api_key": "your-mailgun-api-key"
  }
}
```

For production, set these as Firebase environment secrets:
```bash
firebase functions:secrets:set MAILGUN_DOMAIN
firebase functions:secrets:set MAILGUN_API_KEY
```

### Running Locally

1. **Start the Firebase emulators**
   ```bash
   firebase emulators:start
   ```

2. **In a separate terminal, start the frontend**
   ```bash
   cd frontend
   yarn dev
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Firebase Emulator UI: http://localhost:5008

## Configuration

### Firestore Collections

| Collection | Description |
|------------|-------------|
| `subscriptions` | User subscription preferences and contact info |
| `listings` | Cached listing data to prevent duplicate notifications |
| `ingestion_runs` | Statistics for each scheduled run |

### Filter Options

**Bedroom Preferences:**
- `ANY` - Any bedroom count
- `B1` - 1 bedroom
- `B2` - 2 bedrooms
- `B3` - 3 bedrooms
- `B4` - 4 bedrooms
- `B5_PLUS` - 5+ bedrooms

**Price Preferences:**
- `ANY` - Any price
- `P0_399` - $0 - $399
- `P400_699` - $400 - $699
- `P700_999` - $700 - $999
- `P1000_1499` - $1000 - $1499
- `P1500_PLUS` - $1500+

## Development Notes

### Assumptions
- TheCannon's HTML structure remains stable for web scraping
- Listings are uniquely identified by their URL path
- Users opt-in and can unsubscribe at any time

### Known Limitations
- Web scraping is fragile; HTML changes on TheCannon could break ingestion
- No authentication; subscriptions are public (anyone can unsubscribe with the ID)
- Email rendering requires a separate HTTP call to the Node.js function

### Future Improvements
- Add SMS notification support
- Add listing details like amenities.
- Add rate limiting for subscription creation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Connor Morgan
