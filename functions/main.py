from firebase_functions import https_fn, scheduler_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore, auth
from google.cloud.firestore_v1.base_query import FieldFilter
import requests
from bs4 import BeautifulSoup
import re
import json
import urllib.parse
from datetime import datetime, timedelta
import time
import os

set_global_options(max_instances=10)

# Cloudflare Turnstile configuration
TURNSTILE_SECRET_KEY = os.environ.get('TURNSTILE_SECRET_KEY', '')
TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

# Admin emails allowed to access admin endpoints
ADMIN_EMAILS = [email.strip() for email in os.environ.get('ADMIN_EMAILS', '').split(',') if email.strip()]

initialize_app()


def verify_admin_token(req):
    """
    Verify Firebase Auth ID token and check admin permissions.
    
    Returns:
        dict: {'success': True, 'user': decoded_token} if valid admin
              {'success': False, 'error': str, 'status': int} if invalid
    """
    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return {'success': False, 'error': 'Missing or invalid Authorization header', 'status': 401}
    
    id_token = auth_header.split('Bearer ')[1]
    
    try:
        # Verify the ID token with Firebase Admin SDK
        decoded_token = auth.verify_id_token(id_token)
        user_email = decoded_token.get('email', '')
        
        # Check if user is in admin list
        if user_email not in ADMIN_EMAILS:
            return {'success': False, 'error': 'Unauthorized: Not an admin user', 'status': 403}
        
        return {'success': True, 'user': decoded_token}
    except auth.InvalidIdTokenError:
        return {'success': False, 'error': 'Invalid ID token', 'status': 401}
    except auth.ExpiredIdTokenError:
        return {'success': False, 'error': 'Expired ID token', 'status': 401}
    except Exception as e:
        return {'success': False, 'error': f'Token verification failed: {str(e)}', 'status': 401}


def verify_turnstile_token(token, remote_ip=None):
    """
    Verify Cloudflare Turnstile token.
    
    Returns:
        dict: {
            'success': bool,
            'error': str or None,
            'score': float or None (for managed challenge, if available)
        }
    """
    if not TURNSTILE_SECRET_KEY:
        # If no secret key is configured, allow in development
        is_emulator = os.environ.get('FUNCTIONS_EMULATOR') is not None
        if is_emulator:
            print("Turnstile verification skipped in development (no secret key)")
            return {'success': True, 'error': None, 'score': None}
        else:
            print("ERROR: TURNSTILE_SECRET_KEY not configured in production")
            return {'success': False, 'error': 'Server configuration error', 'score': None}
    
    if not token:
        return {'success': False, 'error': 'Missing security token', 'score': None}
    
    try:
        payload = {
            'secret': TURNSTILE_SECRET_KEY,
            'response': token,
        }
        
        if remote_ip:
            payload['remoteip'] = remote_ip
        
        response = requests.post(TURNSTILE_VERIFY_URL, data=payload, timeout=10)
        result = response.json()
        
        if result.get('success'):
            return {
                'success': True,
                'error': None,
                'score': result.get('score')  # Available with Enterprise
            }
        else:
            error_codes = result.get('error-codes', [])
            error_msg = 'Security verification failed'
            
            if 'timeout-or-duplicate' in error_codes:
                error_msg = 'Security token expired. Please try again.'
            elif 'invalid-input-response' in error_codes:
                error_msg = 'Invalid security response. Please refresh and try again.'
            elif 'bad-request' in error_codes:
                error_msg = 'Security check error. Please try again.'
            
            print(f"Turnstile verification failed: {error_codes}")
            return {'success': False, 'error': error_msg, 'score': None}
            
    except requests.exceptions.Timeout:
        print("Turnstile verification timed out")
        return {'success': False, 'error': 'Security check timed out. Please try again.', 'score': None}
    except Exception as e:
        print(f"Turnstile verification error: {e}")
        return {'success': False, 'error': 'Security verification error', 'score': None}

def get_firestore_client():
    """Get Firestore client instance"""
    return firestore.client()

def increment_stats(notifications_sent=0, subscribers_delta=0):
    """
    Atomically increment stats counters in the metadata/stats document.
    
    Args:
        notifications_sent: Number of notifications sent to add to the total
        subscribers_delta: Change in subscriber count (+1 for new, -1 for unsubscribe)
    """
    try:
        if notifications_sent == 0 and subscribers_delta == 0:
            return
        
        db = get_firestore_client()
        stats_ref = db.collection('metadata').document('stats')
        
        update_data = {}
        if notifications_sent != 0:
            update_data['total_notifications_sent'] = firestore.Increment(notifications_sent)
        if subscribers_delta != 0:
            update_data['total_subscribers'] = firestore.Increment(subscribers_delta)
        
        stats_ref.set(update_data, merge=True)
    except Exception as e:
        print(f"Error updating stats: {e}")

def get_bedroom_bucket(bedroom_count):
    """
    Convert bedroom count to bucket format for matching
    """
    if not bedroom_count:
        return "UNKNOWN"
    
    bedroom_str = str(bedroom_count).lower().strip()
    
    bedroom_match = re.search(r'(\d+)', bedroom_str)
    if bedroom_match:
        bed_num = int(bedroom_match.group(1))
        if bed_num == 1:
            return "B1"
        elif bed_num == 2:
            return "B2"
        elif bed_num == 3:
            return "B3"
        elif bed_num == 4:
            return "B4"
        elif bed_num >= 5:
            return "B5_PLUS"
    
    return "UNKNOWN"

def get_price_bucket(price_int):
    """
    Convert price to bucket format for matching
    """
    if not price_int or price_int <= 0:
        return "UNKNOWN"
    
    if price_int <= 399:
        return "P0_399"
    elif price_int <= 699:
        return "P400_699"
    elif price_int <= 999:
        return "P700_999"
    elif price_int <= 1499:
        return "P1000_1499"
    else:
        return "P1500_PLUS"

def get_active_subscriptions():
    """
    Fetch all active (non-disabled) and verified subscriptions from Firestore.
    - EMAIL subscriptions require isVerified=True to receive notifications
    - WEBHOOK subscriptions are always verified (auto-verified on creation)
    """
    try:
        db = get_firestore_client()
        subscriptions_ref = db.collection('subscriptions')
        query = subscriptions_ref.where(filter=FieldFilter('disabled', '==', None))
        docs = query.stream()
        
        active_subscriptions = []
        for doc in docs:
            subscription_data = doc.to_dict()
            subscription_data['id'] = doc.id
            
            if subscription_data.get('disabled') is None:
                # For EMAIL subscriptions, check if verified
                # Webhooks are always verified, or if isVerified field doesn't exist (legacy), allow it
                sub_type = subscription_data.get('type')
                is_verified = subscription_data.get('isVerified')
                
                # Allow if:
                # - WEBHOOK type (always verified)
                # - isVerified is True
                # - isVerified field doesn't exist (legacy subscriptions)
                if sub_type == 'WEBHOOK' or is_verified is True or is_verified is None:
                    active_subscriptions.append(subscription_data)
        
        return active_subscriptions
    
    except Exception as e:
        print(f"Error fetching active subscriptions: {e}")
        return []

def find_matching_subscriptions(listing_data, frequency_filter=None):
    """
    Find subscriptions that match the given listing.
    Supports both legacy single-value preferences and new array-based preferences.
    
    Args:
        listing_data: The listing data to match against
        frequency_filter: Optional. If provided, only return subscriptions with this frequency.
                         Can be a string or list of strings (e.g., 'REAL_TIME' or ['DAILY', 'WEEKLY'])
    """
    matching_subscriptions = []
    active_subscriptions = get_active_subscriptions()
    
    listing_bedroom_bucket = listing_data.get('bedroom_bucket')
    listing_price_bucket = listing_data.get('price_bucket')
    
    # Normalize frequency_filter to a list
    if frequency_filter is None:
        frequency_list = None
    elif isinstance(frequency_filter, str):
        frequency_list = [frequency_filter]
    else:
        frequency_list = frequency_filter
    
    for subscription in active_subscriptions:
        # Check frequency filter first
        sub_frequency = subscription.get('frequency', 'REAL_TIME')
        if frequency_list is not None and sub_frequency not in frequency_list:
            continue
        
        # Support both legacy (single value) and new (array) formats
        bedroom_prefs = subscription.get('bedroomPreferences')
        if bedroom_prefs is None:
            # Legacy format - convert single value to list
            bedroom_prefs = [subscription.get('bedroomPreference', 'ANY')]
        
        price_prefs = subscription.get('pricePreferences')
        if price_prefs is None:
            # Legacy format - convert single value to list
            price_prefs = [subscription.get('pricePreference', 'ANY')]
        
        bedroom_match = ('ANY' in bedroom_prefs or listing_bedroom_bucket in bedroom_prefs)
        price_match = ('ANY' in price_prefs or listing_price_bucket in price_prefs)
        
        if bedroom_match and price_match:
            matching_subscriptions.append(subscription)
    return matching_subscriptions

def get_readable_bedrooms(bucket):
    """
    Convert bedroom bucket to readable format
    """
    bedroom_map = {
        'B1': '1 bedroom',
        'B2': '2 bedrooms', 
        'B3': '3 bedrooms',
        'B4': '4 bedrooms',
        'B5_PLUS': '5+ bedrooms'
    }
    return bedroom_map.get(bucket, 'Unknown bedrooms')

def get_readable_price_range(bucket):
    """
    Convert price bucket to readable format
    """
    price_map = {
        'P0_399': '$0-399',
        'P400_699': '$400-699',
        'P700_999': '$700-999', 
        'P1000_1499': '$1000-1499',
        'P1500_PLUS': '$1500+'
    }
    return price_map.get(bucket, 'Any price')

def render_email_via_api(listing_data, subscription):
    """
    Call the Next.js API to render the React Email template
    """
    try:
        # Support both legacy (single value) and new (array) formats
        bedroom_prefs = subscription.get('bedroomPreferences')
        if bedroom_prefs is None:
            bedroom_prefs = [subscription.get('bedroomPreference', 'ANY')]
        
        price_prefs = subscription.get('pricePreferences')
        if price_prefs is None:
            price_prefs = [subscription.get('pricePreference', 'ANY')]
        
        # Format bedroom preferences for display
        if 'ANY' in bedroom_prefs:
            readable_sub_bedrooms = 'Any'
        elif len(bedroom_prefs) == 1:
            readable_sub_bedrooms = get_readable_bedrooms(bedroom_prefs[0])
        else:
            readable_sub_bedrooms = ', '.join([get_readable_bedrooms(b) for b in bedroom_prefs])
        
        # Format price preferences for display
        if 'ANY' in price_prefs:
            readable_sub_price = 'Any price'
        elif len(price_prefs) == 1:
            readable_sub_price = get_readable_price_range(price_prefs[0])
        else:
            readable_sub_price = ', '.join([get_readable_price_range(p) for p in price_prefs])
        
        email_props = {
            'price': listing_data.get('price_string', f'${listing_data.get("price_int", "Unknown")}'),
            'bedrooms': get_readable_bedrooms(listing_data.get('bedroom_bucket', '')),
            'address': listing_data.get('address', 'Address not available'),
            'description': listing_data.get('description', 'No description available'),
            'coverImageUrl': listing_data.get('image_url'),
            'listingUrl': listing_data.get('listing_url', '#'),
            'subscriptionBedrooms': readable_sub_bedrooms,
            'subscriptionPriceRange': readable_sub_price,
            'postedAtText': 'Posted today',
            'unsubscribeUrl': f'https://thecannonalerts.ca/unsubscribe?id={urllib.parse.quote(subscription.get("id", ""), safe="")}',
            'listingsOverviewUrl': 'https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date'
        }
        is_production = os.environ.get('FUNCTIONS_EMULATOR') is None
        
        custom_urls = os.environ.get("EMAIL_RENDER_URLS")
        
        # idk which one of these is right
        project_id = (
            os.environ.get("GCLOUD_PROJECT")
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
            or os.environ.get("GCP_PROJECT")
        )

        if not project_id:
            firebase_config = os.environ.get("FIREBASE_CONFIG")
            if firebase_config:
                try:
                    firebase_config_json = json.loads(firebase_config)
                    project_id = firebase_config_json.get("projectId")
                except Exception as parse_error:
                    print(f"Could not parse FIREBASE_CONFIG for projectId: {parse_error}")

        if custom_urls:
            api_urls = [url.strip() for url in custom_urls.split(",") if url.strip()]
        else:
            if not project_id:
                print("No EMAIL_RENDER_URLS set and projectId is unknown; cannot render emails")
                return None

            if is_production:
                api_urls = [f"https://us-central1-{project_id}.cloudfunctions.net/renderEmail"]
            else:
                api_urls = [f"http://127.0.0.1:5001/{project_id}/us-central1/renderEmail"]
        
        max_attempts = 5
        for attempt in range(1, max_attempts + 1):
            for api_url in api_urls:
                try:
                    response = requests.post(api_url, json=email_props, timeout=10)
                    
                    if response.status_code == 200:
                        return response.text
                    print(f"Render attempt {attempt} to {api_url} returned status {response.status_code}")
                except requests.exceptions.RequestException as e:
                    print(f"Failed to connect to {api_url} on attempt {attempt}: {e}")
                # If one URL fails, try the next URL before deciding to back off
            if attempt < max_attempts:
                delay_seconds = min(2 ** attempt, 30)
                print(f"Render attempt {attempt} failed; retrying in {delay_seconds} seconds")
                time.sleep(delay_seconds)
        
        print("Exhausted email render attempts; not sending email")
        return None
            
    except Exception as e:
        print(f"Error calling email render API: {e}")
        return None

def send_email_via_mailgun(to_email, subject, html_content):
    """
    Send email using Mailgun API
    """
    try:
        MAILGUN_DOMAIN = os.environ.get('MAILGUN_DOMAIN', '').strip()
        MAILGUN_API_KEY = os.environ.get('MAILGUN_API_KEY', '').strip()
        
        if not MAILGUN_DOMAIN or not MAILGUN_API_KEY:
            runtimeconfig_path = os.path.join(os.path.dirname(__file__), '.runtimeconfig.json')
            if os.path.exists(runtimeconfig_path):
                try:
                    with open(runtimeconfig_path, 'r') as f:
                        config = json.load(f)
                        MAILGUN_DOMAIN = config.get('mailgun', {}).get('domain') or MAILGUN_DOMAIN
                        MAILGUN_API_KEY = config.get('mailgun', {}).get('api_key') or MAILGUN_API_KEY
                except Exception as e:
                    print(f"Error reading .runtimeconfig.json: {e}")
        
        if not MAILGUN_DOMAIN or not MAILGUN_API_KEY:
            print(f"Error: Mailgun configuration not found in environment variables or .runtimeconfig.json")
            return False
        
        url = f"https://api.mailgun.net/v3/{MAILGUN_DOMAIN}/messages"
        
        data = {
            "from": f"TheCannon Alerts <postmaster@{MAILGUN_DOMAIN}>",
            "to": to_email,
            "subject": subject,
            "html": html_content
        }
        
        response = requests.post(
            url,
            auth=("api", MAILGUN_API_KEY),
            data=data
        )
        
        if response.status_code == 200:
            return True
        else:
            print(f"Mailgun error {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"Error sending email via Mailgun: {e}")
        return False

def render_digest_email_via_api(listings_data, subscription, digest_type):
    """
    Call the Next.js API to render the React Email digest template
    """
    try:
        # Support both legacy (single value) and new (array) formats
        bedroom_prefs = subscription.get('bedroomPreferences')
        if bedroom_prefs is None:
            bedroom_prefs = [subscription.get('bedroomPreference', 'ANY')]
        
        price_prefs = subscription.get('pricePreferences')
        if price_prefs is None:
            price_prefs = [subscription.get('pricePreference', 'ANY')]
        
        # Format bedroom preferences for display
        if 'ANY' in bedroom_prefs:
            readable_sub_bedrooms = 'Any'
        elif len(bedroom_prefs) == 1:
            readable_sub_bedrooms = get_readable_bedrooms(bedroom_prefs[0])
        else:
            readable_sub_bedrooms = ', '.join([get_readable_bedrooms(b) for b in bedroom_prefs])
        
        # Format price preferences for display
        if 'ANY' in price_prefs:
            readable_sub_price = 'Any price'
        elif len(price_prefs) == 1:
            readable_sub_price = get_readable_price_range(price_prefs[0])
        else:
            readable_sub_price = ', '.join([get_readable_price_range(p) for p in price_prefs])
        
        # Format listings for the digest email
        formatted_listings = []
        for listing in listings_data:
            formatted_listings.append({
                'price': listing.get('price_string', f'${listing.get("price_int", "Unknown")}'),
                'bedrooms': get_readable_bedrooms(listing.get('bedroom_bucket', '')),
                'address': listing.get('address', 'Address not available'),
                'coverImageUrl': listing.get('image_url'),
                'listingUrl': listing.get('listing_url', '#'),
                'dateAvailable': listing.get('additional_details', {}).get('date_available'),
                'features': listing.get('additional_details', {}).get('features', []),
            })
        
        # Calculate period dates
        now = datetime.now()
        if digest_type == 'daily':
            period_start = (now - timedelta(days=1)).strftime('%b %d, %Y')
            period_end = now.strftime('%b %d, %Y')
        else:  # weekly
            period_start = (now - timedelta(days=7)).strftime('%b %d, %Y')
            period_end = now.strftime('%b %d, %Y')
        
        email_props = {
            'listings': formatted_listings,
            'digestType': digest_type,
            'subscriptionBedrooms': readable_sub_bedrooms,
            'subscriptionPriceRange': readable_sub_price,
            'unsubscribeUrl': f'https://thecannonalerts.ca/unsubscribe?id={urllib.parse.quote(subscription.get("id", ""), safe="")}',
            'listingsOverviewUrl': 'https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date',
            'periodStart': period_start,
            'periodEnd': period_end,
        }
        
        is_production = os.environ.get('FUNCTIONS_EMULATOR') is None
        
        custom_urls = os.environ.get("EMAIL_RENDER_URLS")
        
        project_id = (
            os.environ.get("GCLOUD_PROJECT")
            or os.environ.get("GOOGLE_CLOUD_PROJECT")
            or os.environ.get("GCP_PROJECT")
        )

        if not project_id:
            firebase_config = os.environ.get("FIREBASE_CONFIG")
            if firebase_config:
                try:
                    firebase_config_json = json.loads(firebase_config)
                    project_id = firebase_config_json.get("projectId")
                except Exception as parse_error:
                    print(f"Could not parse FIREBASE_CONFIG for projectId: {parse_error}")

        if custom_urls:
            api_urls = [url.strip() for url in custom_urls.split(",") if url.strip()]
        else:
            if not project_id:
                print("No EMAIL_RENDER_URLS set and projectId is unknown; cannot render emails")
                return None

            if is_production:
                api_urls = [f"https://us-central1-{project_id}.cloudfunctions.net/renderDigestEmail"]
            else:
                api_urls = [f"http://127.0.0.1:5001/{project_id}/us-central1/renderDigestEmail"]
        
        max_attempts = 5
        for attempt in range(1, max_attempts + 1):
            for api_url in api_urls:
                try:
                    response = requests.post(api_url, json=email_props, timeout=15)
                    
                    if response.status_code == 200:
                        return response.text
                    print(f"Digest render attempt {attempt} to {api_url} returned status {response.status_code}")
                except requests.exceptions.RequestException as e:
                    print(f"Failed to connect to {api_url} on attempt {attempt}: {e}")
            if attempt < max_attempts:
                delay_seconds = min(2 ** attempt, 30)
                print(f"Digest render attempt {attempt} failed; retrying in {delay_seconds} seconds")
                time.sleep(delay_seconds)
        
        print("Exhausted digest email render attempts; not sending email")
        return None
            
    except Exception as e:
        print(f"Error calling digest email render API: {e}")
        return None


def send_digest_email_notification(subscription, listings_data, digest_type):
    """
    Send digest email notification for multiple listings using Mailgun and React Email
    """
    try:
        email = subscription.get('email')
        if not email:
            return False
        
        html_content = render_digest_email_via_api(listings_data, subscription, digest_type)
        
        if not html_content:
            print(f"Failed to render digest email template for {email}")
            return False
        
        listing_count = len(listings_data)
        digest_label = "Daily" if digest_type == "daily" else "Weekly"
        subject = f"TheCannon {digest_label} Digest: {listing_count} new listing{'s' if listing_count != 1 else ''}"
        
        success = send_email_via_mailgun(email, subject, html_content)
        
        return success
        
    except Exception as e:
        print(f"Error sending digest email notification: {e}")
        return False


def send_email_notification(subscription, listing_data):
    """
    Send email notification for a matching listing using Mailgun and React Email
    """
    try:
        email = subscription.get('email')
        if not email:
            return False
        
        html_content = render_email_via_api(listing_data, subscription)
        
        if not html_content:
            print(f"Failed to render email template for {email}")
            return False
        
        price = listing_data.get('price_string', f'${listing_data.get("price_int", "Unknown")}')
        address = listing_data.get('address', 'New listing')
        subject = f"New TheCannon Match: {price} - {address}"
        
        success = send_email_via_mailgun(email, subject, html_content)
        
        return success
        
    except Exception as e:
        print(f"Error sending email notification: {e}")
        return False

def send_webhook_notification(subscription, listing_data):
    """
    Send Discord webhook notification for a matching listing
    """
    try:
        webhook_url = subscription.get('webhookUrl')
        if not webhook_url:
            return False
        
        embed = {
            "title": "New TheCannon Listing Match!",
            "description": f"A new listing matches your criteria",
            "color": 0xEAB308,
            "fields": [
                {
                    "name": "Address",
                    "value": listing_data.get('address', 'Unknown address'),
                    "inline": True
                },
                {
                    "name": "Price",
                    "value": listing_data.get('price_string', 'Unknown price'),
                    "inline": True
                },
                {
                    "name": "Bedrooms",
                    "value": listing_data.get('bedroom_count', 'Unknown'),
                    "inline": True
                }
            ],
            "url": listing_data.get('listing_url', ''),
            "timestamp": datetime.now().isoformat()
        }
        
        if listing_data.get('image_url'):
            embed["thumbnail"] = {"url": listing_data['image_url']}
        
        if listing_data.get('description'):
            description = listing_data['description']
            if len(description) > 200:
                description = description[:197] + "..."
            embed["fields"].append({
                "name": "Description",
                "value": description,
                "inline": False
            })
        
        embed["fields"].append({
            "name": "Manage Subscription",
            "value": f"[Unsubscribe from alerts](https://thecannonalerts.ca/unsubscribe?id={urllib.parse.quote(subscription.get('id', ''), safe='')})",
            "inline": False
        })
        
        payload = {
            "embeds": [embed]
        }
        
        response = requests.post(webhook_url, json=payload)
        
        if response.status_code == 204:
            return True
        else:
            return False
            
    except Exception as e:
        print(f"Error sending webhook notification: {e}")
        return False

def send_verification_webhook_notification(subscription_data, subscription_id):
    """
    Send Discord webhook notification when a new email subscription requires verification
    """
    try:
        webhook_url = os.environ.get('VERIFICATION_WEBHOOK_URL', '').strip()
        
        # For local development, check .runtimeconfig.json
        if not webhook_url:
            runtimeconfig_path = os.path.join(os.path.dirname(__file__), '.runtimeconfig.json')
            if os.path.exists(runtimeconfig_path):
                try:
                    with open(runtimeconfig_path, 'r') as f:
                        config = json.load(f)
                        webhook_url = config.get('verification_webhook_url', '').strip() or webhook_url
                except Exception as e:
                    print(f"Error reading .runtimeconfig.json: {e}")
        
        if not webhook_url:
            print("VERIFICATION_WEBHOOK_URL not configured, skipping notification")
            return False
        
        # Format bedroom preferences
        bedroom_prefs = subscription_data.get('bedroomPreferences', [])
        if not bedroom_prefs:
            bedroom_prefs = [subscription_data.get('bedroomPreference', 'ANY')]
        bedroom_display = ', '.join([get_readable_bedrooms(b) for b in bedroom_prefs]) if 'ANY' not in bedroom_prefs else 'Any'
        
        # Format price preferences
        price_prefs = subscription_data.get('pricePreferences', [])
        if not price_prefs:
            price_prefs = [subscription_data.get('pricePreference', 'ANY')]
        price_display = ', '.join([get_readable_price_range(p) for p in price_prefs]) if 'ANY' not in price_prefs else 'Any price'
        
        # Format frequency
        frequency = subscription_data.get('frequency', 'REAL_TIME')
        frequency_map = {
            'REAL_TIME': 'Real-time',
            'DAILY': 'Daily digest',
            'WEEKLY': 'Weekly digest'
        }
        frequency_display = frequency_map.get(frequency, frequency.capitalize())
        
        embed = {
            "title": "🔔 New Email Subscription Requires Verification",
            "description": f"A new email subscription has been created and requires admin verification.",
            "color": 0xFFA500,  # Orange color for alerts
            "fields": [
                {
                    "name": "Email",
                    "value": subscription_data.get('email', 'Unknown'),
                    "inline": True
                },
                {
                    "name": "Frequency",
                    "value": frequency_display,
                    "inline": True
                },
                {
                    "name": "Bedrooms",
                    "value": bedroom_display,
                    "inline": True
                },
                {
                    "name": "Price Range",
                    "value": price_display,
                    "inline": True
                },
                {
                    "name": "Subscription ID",
                    "value": subscription_id,
                    "inline": False
                }
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        payload = {
            "embeds": [embed]
        }
        
        response = requests.post(webhook_url, json=payload, timeout=10)
        
        if response.status_code in [200, 204]:
            return True
        else:
            print(f"Discord webhook returned status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"Error sending verification webhook notification: {e}")
        return False

def send_notifications_for_listing(listing_data):
    """
    Find matching subscriptions and send notifications.
    Only sends to REAL_TIME subscribers (digest subscribers get batched notifications).
    Deduplicates by email/webhook to prevent sending multiple notifications
    to the same recipient for the same listing.
    """
    try:
        # Only find subscriptions with REAL_TIME frequency
        matching_subscriptions = find_matching_subscriptions(listing_data, frequency_filter='REAL_TIME')
        
        if not matching_subscriptions:
            return {"sent": 0, "errors": 0}
        
        # Deduplicate subscriptions by email/webhook
        # Use the first matching subscription for each unique recipient
        seen_emails = set()
        seen_webhooks = set()
        unique_subscriptions = []
        
        for subscription in matching_subscriptions:
            if subscription['type'] == 'EMAIL':
                email = subscription.get('email', '').lower()
                if email and email not in seen_emails:
                    seen_emails.add(email)
                    unique_subscriptions.append(subscription)
            elif subscription['type'] == 'WEBHOOK':
                webhook_url = subscription.get('webhookUrl', '')
                if webhook_url and webhook_url not in seen_webhooks:
                    seen_webhooks.add(webhook_url)
                    unique_subscriptions.append(subscription)
        
        sent_count = 0
        error_count = 0
        
        for subscription in unique_subscriptions:
            try:
                if subscription['type'] == 'EMAIL':
                    success = send_email_notification(subscription, listing_data)
                elif subscription['type'] == 'WEBHOOK':
                    success = send_webhook_notification(subscription, listing_data)
                else:
                    continue
                
                if success:
                    sent_count += 1
                else:
                    error_count += 1
                    
            except Exception as e:
                print(f"Error processing subscription {subscription['id']}: {e}")
                error_count += 1
        
        return {"sent": sent_count, "errors": error_count}
        
    except Exception as e:
        print(f"Error in send_notifications_for_listing: {e}")
        return {"sent": 0, "errors": 1}

def CheckIfListingNew(listing_url):
    """
    Check if a listing already exists in Firestore
    Returns True if listing is new, False if it already exists
    """
    try:
        if listing_url.endswith('/'):
            listing_id = listing_url.split('/')[-2]
        else:
            listing_id = listing_url.split('/')[-1]
        
        db = get_firestore_client()
        doc_ref = db.collection('listings').document(listing_id)
        doc = doc_ref.get()
        
        if doc.exists:
            return False
        else:
            return True
            
    except Exception as e:
        print(f"Error checking if listing is new: {e}")
        return True

def addListingToFirestore(listing_data):
    """
    Add a listing to Firestore
    """
    try:
        listing_url = listing_data['listing_url']
        if listing_url.endswith('/'):
            listing_id = listing_url.split('/')[-2]
        else:
            listing_id = listing_url.split('/')[-1]
        
        firestore_data = listing_data.copy()
        firestore_data['created_at'] = datetime.now()
        firestore_data['updated_at'] = datetime.now()
        firestore_data['listing_id'] = listing_id
        
        db = get_firestore_client()
        doc_ref = db.collection('listings').document(listing_id)
        doc_ref.set(firestore_data)
        
        return True
        
    except Exception as e:
        print(f"Error adding listing to Firestore: {e}")
        return False

def ingestHouseListings():
    response = requests.get('https://thecannon.ca/housing/?search=&search2=&wanted_forsale=forsale&sortby=date&viewmode=grid')
    soup = BeautifulSoup(response.text, 'html.parser')
    house_listing = soup.find_all('li', class_='housing-item')
    return house_listing

def ingestListingDetails(listing_url):
    response = requests.get(listing_url)
    soup = BeautifulSoup(response.text, 'html.parser')

    image_url = None
    og_image = soup.find('meta', property='og:image')
    if og_image:
        image_url = og_image.get('content')
    else:
        first_photo = soup.select_one('.masonry.lightbox-gallery li a')
        if first_photo:
            image_url = first_photo.get('href')

    address = None
    address_div = soup.select_one('.classified-details .row .md')
    if address_div:
        address = address_div.get_text(strip=True)

    description = None
    description_dd = soup.select_one('.classified-details .description')
    if description_dd:
        description_text = description_dd.get_text(separator=' ', strip=True)
        if "More Information" in description_text:
            description_text = description_text.replace("More Information", "").strip()
        description = description_text

    price = None
    price_strong = soup.select_one('.classified-details .row strong')
    if price_strong:
        price_text = price_strong.get_text(strip=True)
        price_match = re.search(r'\$?([\d,]+)', price_text)
        if price_match:
            price = int(price_match.group(1).replace(',', ''))

    price_string = None
    if price_strong:
        price_string = price_strong.get_text(strip=True)

    bedroom_count = None
    beds_row = soup.find('dt', string='Beds')
    if beds_row:
        beds_dd = beds_row.find_next_sibling('dd')
        if beds_dd:
            bedroom_count = beds_dd.get_text(strip=True)

    additional_details = {}
    
    category_dt = soup.find('dt', string='Category')
    if category_dt:
        category_dd = category_dt.find_next_sibling('dd')
        if category_dd:
            additional_details['category'] = category_dd.get_text(strip=True)
    
    date_available_dt = soup.find('dt', string='Date Available')
    if date_available_dt:
        date_available_dd = date_available_dt.find_next_sibling('dd')
        if date_available_dd:
            additional_details['date_available'] = date_available_dd.get_text(strip=True)
    
    shared_dt = soup.find('dt', string='Shared')
    if shared_dt:
        shared_dd = shared_dt.find_next_sibling('dd')
        if shared_dd:
            additional_details['shared'] = shared_dd.get_text(strip=True)
    
    sublet_dt = soup.find('dt', string='Sublet')
    if sublet_dt:
        sublet_dd = sublet_dt.find_next_sibling('dd')
        if sublet_dd:
            additional_details['sublet'] = sublet_dd.get_text(strip=True)
    
    features = []
    feature_tooltips = soup.select('.housing-features .tooltip')
    for tooltip in feature_tooltips:
        features.append(tooltip.get_text(strip=True))
    if features:
        additional_details['features'] = features

    bedroom_bucket = get_bedroom_bucket(bedroom_count)
    
    price_bucket = get_price_bucket(price)

    listingData = {
        'listing_url': listing_url,
        'image_url': image_url,
        'address': address,
        'description': description,
        'price_int': price,
        'price_string': price_string,
        'bedroom_count': bedroom_count,
        'bedroom_bucket': bedroom_bucket,
        'price_bucket': price_bucket,
        'additional_details': additional_details
    }
    return listingData

def ingest_listings_core():
    """
    Core listing ingestion logic that can be called from HTTP or scheduled functions
    Returns a dictionary with results
    """
    house_listings = ingestHouseListings()
    listing_data = []
    notification_summary = {"total_sent": 0, "total_errors": 0}

    for listing in house_listings:
        listing_url = listing.find('h2').find('a')['href']
        new_listing = CheckIfListingNew(listing_url)
        if new_listing:
            try:
                single_listing_data = ingestListingDetails(listing_url)
                listing_data.append(single_listing_data)
                firestore_success = addListingToFirestore(single_listing_data)
                
                if firestore_success:
                    notification_result = send_notifications_for_listing(single_listing_data)
                    notification_summary["total_sent"] += notification_result["sent"]
                    notification_summary["total_errors"] += notification_result["errors"]
                    
            except Exception as e:
                print(f"Error processing listing {listing_url}: {e}")
                continue

    # Increment the stats counter for notifications sent
    if notification_summary["total_sent"] > 0:
        increment_stats(notifications_sent=notification_summary["total_sent"])
    
    response_data = {
        "listings_processed": len(listing_data),
        "listing_data": listing_data,
        "notifications_sent": notification_summary["total_sent"],
        "notification_errors": notification_summary["total_errors"]
    }
    
    return response_data

@https_fn.on_request(secrets=["TURNSTILE_SECRET_KEY", "VERIFICATION_WEBHOOK_URL"])
def create_subscription(req: https_fn.Request) -> https_fn.Response:
    """
    Create a new subscription for housing alerts
    
    Expected JSON payload:
    {
        "type": "EMAIL" | "WEBHOOK",
        "email": "user@example.com" (required if type is EMAIL),
        "webhookUrl": "https://example.com/webhook" (required if type is WEBHOOK),
        "bedroomPreferences": ["ANY"] | ["B1", "B2", ...] (array of bedroom preferences),
        "pricePreferences": ["ANY"] | ["P0_399", "P400_699", ...] (array of price preferences),
        "userId": "optional-user-id" (for user-based doc IDs),
        "turnstileToken": "cloudflare-turnstile-token" (required for bot protection)
    }
    
    Note: Legacy single-value format (bedroomPreference, pricePreference) is still supported
    for backwards compatibility but new subscriptions should use the array format.
    """
    
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response(
                json.dumps({"error": "No JSON data provided"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        # Verify Turnstile token for bot protection
        turnstile_token = request_data.get('turnstileToken')
        remote_ip = req.headers.get('CF-Connecting-IP') or req.headers.get('X-Forwarded-For', '').split(',')[0].strip() or req.remote_addr
        
        turnstile_result = verify_turnstile_token(turnstile_token, remote_ip)
        
        if not turnstile_result['success']:
            return https_fn.Response(
                json.dumps({"error": turnstile_result['error'] or "Security verification failed"}),
                status=403,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        validation_result = validate_subscription_data(request_data)
        if validation_result["error"]:
            return https_fn.Response(
                json.dumps({"error": validation_result["error"]}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        existing_subscription_result = check_existing_subscription(request_data)
        
        if existing_subscription_result["exists"]:
            if existing_subscription_result["disabled"]:
                subscription_document_reference = renable_subscription(existing_subscription_result["subscription_id"])
                response_message = "Your previous subscription has been re-enabled successfully"
            else:
                return https_fn.Response(
                    json.dumps({
                        "error": "You already have an active subscription with these exact preferences",
                        "existing_subscription_id": existing_subscription_result["subscription_id"]
                    }),
                    status=409,
                    headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
                )
        elif existing_subscription_result.get("overlap"):
            return https_fn.Response(
                json.dumps({
                    "error": existing_subscription_result["overlap_details"]
                }),
                status=409,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        else:
            subscription_document_reference = create_subscription_document(request_data)
            response_message = "Subscription created successfully"
        
        response_data = {
            "success": True,
            "subscriptionDocumentReference": subscription_document_reference,
            "message": response_message
        }
        
        return https_fn.Response(
            json.dumps(response_data),
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
        
    except Exception as e:
        print(f"Error creating subscription: {e}")
        return https_fn.Response(
            json.dumps({"error": "Internal server error"}),
            status=500,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

@https_fn.on_request(secrets=["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "TURNSTILE_SECRET_KEY"])
def send_test_notification(req: https_fn.Request) -> https_fn.Response:
    """
    Send a test notification to a subscription

    Expected JSON payload:
    {
        "subscription_id": "subscription-document-id",
        "type": "EMAIL" | "WEBHOOK",
        "email": "user@example.com" (if type is EMAIL),
        "webhookUrl": "https://example.com/webhook" (if type is WEBHOOK),
        "turnstileToken": "cloudflare-turnstile-token" (required for bot protection)
    }
    """

    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '3600'
            }
        )

    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response(
                json.dumps({"error": "No JSON data provided"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )

        # Verify Turnstile token for bot protection
        turnstile_token = request_data.get('turnstileToken')
        remote_ip = req.headers.get('CF-Connecting-IP') or req.headers.get('X-Forwarded-For', '').split(',')[0].strip() or req.remote_addr
        
        turnstile_result = verify_turnstile_token(turnstile_token, remote_ip)
        
        if not turnstile_result['success']:
            return https_fn.Response(
                json.dumps({"error": turnstile_result['error'] or "Security verification failed"}),
                status=403,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )

        subscription_id = request_data.get('subscription_id')
        notification_type = request_data.get('type')
        email = request_data.get('email')
        webhook_url = request_data.get('webhookUrl')

        if not subscription_id:
            return https_fn.Response(
                json.dumps({"error": "subscription_id is required"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )

        if notification_type not in ['EMAIL', 'WEBHOOK']:
            return https_fn.Response(
                json.dumps({"error": "type must be either EMAIL or WEBHOOK"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )

        if notification_type == 'EMAIL' and not email:
            return https_fn.Response(
                json.dumps({"error": "email is required for EMAIL type"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )

        if notification_type == 'WEBHOOK' and not webhook_url:
            return https_fn.Response(
                json.dumps({"error": "webhookUrl is required for WEBHOOK type"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )

        # Create test listing data
        test_listing_data = {
            "address": "123 Test Street, Guelph ON",
            "price_string": "$1,234/month",
            "price_int": 1234,
            "bedroom_count": "2 Bedrooms",
            "listing_url": "https://thecannon.ca/test-listing",
            "image_url": "https://thecannon.ca/placeholder-image.jpg",
            "description": "This is a test notification from TheCannon Alerts. This listing matches your preferences and you would receive a real notification when a similar property becomes available on TheCannon."
        }

        # Create subscription object for notification functions
        subscription_data = {
            "id": subscription_id,
            "type": notification_type
        }

        if notification_type == 'EMAIL':
            subscription_data["email"] = email
            success = send_email_notification(subscription_data, test_listing_data)
        else:
            subscription_data["webhookUrl"] = webhook_url
            success = send_webhook_notification(subscription_data, test_listing_data)

        if success:
            return https_fn.Response(
                json.dumps({"success": True, "message": "Test notification sent successfully"}),
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        else:
            return https_fn.Response(
                json.dumps({"error": "Failed to send test notification"}),
                status=500,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )

    except Exception as e:
        print(f"Error sending test notification: {e}")
        return https_fn.Response(
            json.dumps({"error": "Internal server error"}),
            status=500,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

def validate_subscription_data(data):
    """
    Validate subscription data
    Returns: {"error": None} if valid, {"error": "message"} if invalid
    Supports both legacy single-value and new array-based preferences.
    """
    
    VALID_TYPES = ["EMAIL", "WEBHOOK"]
    VALID_BEDROOM_PREFS = ["ANY", "B1", "B2", "B3", "B4", "B5_PLUS"]
    VALID_PRICE_PREFS = ["ANY", "P0_399", "P400_699", "P700_999", "P1000_1499", "P1500_PLUS"]
    VALID_FREQUENCIES = ["REAL_TIME", "DAILY", "WEEKLY"]
    
    if "type" not in data:
        return {"error": "Missing required field: type"}
    
    if data["type"] not in VALID_TYPES:
        return {"error": f"Invalid type. Must be one of: {', '.join(VALID_TYPES)}"}
    
    if data["type"] == "EMAIL":
        if not data.get("email"):
            return {"error": "Email is required when type is EMAIL"}
        if "@" not in data["email"]:
            return {"error": "Invalid email format"}
    
    if data["type"] == "WEBHOOK":
        if not data.get("webhookUrl"):
            return {"error": "webhookUrl is required when type is WEBHOOK"}
        if not data["webhookUrl"].startswith(("http://", "https://")):
            return {"error": "Invalid webhook URL format"}
    
    # Support both legacy (single value) and new (array) formats for bedroom preferences
    bedroom_prefs = data.get("bedroomPreferences")
    if bedroom_prefs is not None:
        if not isinstance(bedroom_prefs, list) or len(bedroom_prefs) == 0:
            return {"error": "bedroomPreferences must be a non-empty array"}
        for pref in bedroom_prefs:
            if pref not in VALID_BEDROOM_PREFS:
                return {"error": f"Invalid bedroom preference '{pref}'. Must be one of: {', '.join(VALID_BEDROOM_PREFS)}"}
    else:
        # Legacy single value format
        bedroom_pref = data.get("bedroomPreference", "ANY")
        if bedroom_pref not in VALID_BEDROOM_PREFS:
            return {"error": f"Invalid bedroomPreference. Must be one of: {', '.join(VALID_BEDROOM_PREFS)}"}
    
    # Support both legacy (single value) and new (array) formats for price preferences
    price_prefs = data.get("pricePreferences")
    if price_prefs is not None:
        if not isinstance(price_prefs, list) or len(price_prefs) == 0:
            return {"error": "pricePreferences must be a non-empty array"}
        for pref in price_prefs:
            if pref not in VALID_PRICE_PREFS:
                return {"error": f"Invalid price preference '{pref}'. Must be one of: {', '.join(VALID_PRICE_PREFS)}"}
    else:
        # Legacy single value format
        price_pref = data.get("pricePreference", "ANY")
        if price_pref not in VALID_PRICE_PREFS:
            return {"error": f"Invalid pricePreference. Must be one of: {', '.join(VALID_PRICE_PREFS)}"}
    
    # Validate frequency (optional, defaults to REAL_TIME)
    frequency = data.get("frequency", "REAL_TIME")
    if frequency not in VALID_FREQUENCIES:
        return {"error": f"Invalid frequency. Must be one of: {', '.join(VALID_FREQUENCIES)}"}
    
    # Validate sendTime format if provided (should be HH:MM in 24-hour format)
    send_time = data.get("sendTime")
    if send_time and send_time.strip():
        import re as regex
        if not regex.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9]$', send_time):
            return {"error": "Invalid sendTime format. Must be in HH:MM format (e.g., '09:00' or '14:30')"}
    
    return {"error": None}

def check_existing_subscription(data):
    """
    Check if a subscription already exists for the same email/webhook and preferences.
    Also checks for overlapping subscriptions that would cause duplicate notifications.
    
    Overlap occurs when a listing could match BOTH subscriptions, which happens when:
    - There's at least one bedroom value in common (or either has ANY)
    - AND there's at least one price value in common (or either has ANY)
    
    Supports both legacy single-value and new array-based preferences.
    Returns: {"exists": bool, "disabled": bool, "subscription_id": str, "overlap": bool, "overlap_details": str}
    """
    try:
        db = get_firestore_client()
        subscriptions_ref = db.collection('subscriptions')
        
        # Query by email/webhook and type only, then filter by preferences in code
        if data["type"] == "EMAIL":
            query = subscriptions_ref.where('email', '==', data["email"])
        else:
            query = subscriptions_ref.where('webhookUrl', '==', data["webhookUrl"])
        
        query = query.where('type', '==', data["type"])
        
        # Get the preferences from the incoming data (support both formats)
        incoming_bedroom_prefs = data.get("bedroomPreferences")
        if incoming_bedroom_prefs is None:
            incoming_bedroom_prefs = [data.get("bedroomPreference", "ANY")]
        incoming_bedroom_set = set(incoming_bedroom_prefs)
        
        incoming_price_prefs = data.get("pricePreferences")
        if incoming_price_prefs is None:
            incoming_price_prefs = [data.get("pricePreference", "ANY")]
        incoming_price_set = set(incoming_price_prefs)
        
        docs = query.stream()
        
        for doc in docs:
            subscription_data = doc.to_dict()
            
            # Skip disabled subscriptions
            if subscription_data.get('disabled') is not None:
                continue
            
            # Get existing subscription's preferences (support both formats)
            existing_bedroom_prefs = subscription_data.get('bedroomPreferences')
            if existing_bedroom_prefs is None:
                existing_bedroom_prefs = [subscription_data.get('bedroomPreference', 'ANY')]
            existing_bedroom_set = set(existing_bedroom_prefs)
            
            existing_price_prefs = subscription_data.get('pricePreferences')
            if existing_price_prefs is None:
                existing_price_prefs = [subscription_data.get('pricePreference', 'ANY')]
            existing_price_set = set(existing_price_prefs)
            
            # Check for exact match (same filters)
            if sorted(existing_bedroom_prefs) == sorted(incoming_bedroom_prefs) and \
               sorted(existing_price_prefs) == sorted(incoming_price_prefs):
                return {
                    "exists": True,
                    "disabled": False,
                    "subscription_id": doc.id,
                    "overlap": False,
                    "overlap_details": None
                }
            
            # Check for overlapping preferences
            # Overlap in bedrooms: either has ANY, or there's intersection
            has_bedroom_overlap = ('ANY' in incoming_bedroom_set or 
                                  'ANY' in existing_bedroom_set or 
                                  bool(incoming_bedroom_set & existing_bedroom_set))
            
            # Overlap in prices: either has ANY, or there's intersection
            has_price_overlap = ('ANY' in incoming_price_set or 
                                'ANY' in existing_price_set or 
                                bool(incoming_price_set & existing_price_set))
            
            # Only block if BOTH dimensions overlap (a listing could match both subscriptions)
            if has_bedroom_overlap and has_price_overlap:
                # Build helpful error message
                if 'ANY' in incoming_bedroom_set or 'ANY' in existing_bedroom_set:
                    bedroom_overlap_str = "any bedrooms"
                else:
                    overlap_bedrooms = incoming_bedroom_set & existing_bedroom_set
                    bedroom_overlap_str = ", ".join(sorted(overlap_bedrooms))
                
                if 'ANY' in incoming_price_set or 'ANY' in existing_price_set:
                    price_overlap_str = "any price"
                else:
                    overlap_prices = incoming_price_set & existing_price_set
                    price_overlap_str = ", ".join(sorted(overlap_prices))
                
                return {
                    "exists": False,
                    "disabled": False,
                    "subscription_id": None,
                    "overlap": True,
                    "overlap_details": f"Your new subscription overlaps with an existing one. Overlapping filters: bedrooms ({bedroom_overlap_values}), prices ({price_overlap_values}). Please choose non-overlapping filters."
                }
        
        return {"exists": False, "disabled": False, "subscription_id": None, "overlap": False, "overlap_details": None}
        
    except Exception as e:
        print(f"Error checking existing subscription: {e}")
        return {"exists": False, "disabled": False, "subscription_id": None, "overlap": False, "overlap_details": None}

def renable_subscription(subscription_id):
    """
    Re-enable a disabled subscription
    Returns: subscription_id
    """
    try:
        db = get_firestore_client()
        doc_ref = db.collection('subscriptions').document(subscription_id)
        doc_ref.update({
            'disabled': None,
            'updated_at': datetime.now()
        })
        
        # Increment subscriber count since they're re-subscribing
        increment_stats(subscribers_delta=1)
        
        return subscription_id
        
    except Exception as e:
        print(f"Error re-enabling subscription: {e}")
        return None

def create_subscription_document(data):
    """
    Create subscription document in Firestore.
    Stores preferences in the new array format.
    Returns: document reference
    """
    # Convert to array format if legacy single-value format is used
    bedroom_prefs = data.get("bedroomPreferences")
    if bedroom_prefs is None:
        bedroom_prefs = [data.get("bedroomPreference", "ANY")]
    
    price_prefs = data.get("pricePreferences")
    if price_prefs is None:
        price_prefs = [data.get("pricePreference", "ANY")]
    
    # Get frequency and sendTime (defaults to REAL_TIME)
    frequency = data.get("frequency", "REAL_TIME")
    send_time = data.get("sendTime", "").strip() or None
    
    # Webhooks are auto-verified, emails need manual verification
    is_verified = data["type"] == "WEBHOOK"
    
    subscription_data = {
        "type": data["type"],
        "email": data.get("email"),
        "webhookUrl": data.get("webhookUrl"),
        "bedroomPreferences": bedroom_prefs,
        "pricePreferences": price_prefs,
        "frequency": frequency,
        "sendTime": send_time,
        "disabled": None,
        "createdAt": datetime.now(),
        "lastDigestSentAt": None,  # Track when the last digest was sent
        "isVerified": is_verified,  # Webhooks auto-verified, emails need admin verification
    }
    
    db = get_firestore_client()
    doc_ref = db.collection('subscriptions').add(subscription_data)
    subscription_id = doc_ref[1].id
    
    # Increment the subscriber count
    increment_stats(subscribers_delta=1)
    
    # Send Discord webhook notification if this is an EMAIL subscription requiring verification
    if not is_verified and data["type"] == "EMAIL":
        send_verification_webhook_notification(subscription_data, subscription_id)

    return subscription_id

@https_fn.on_request()
def unsubscribe(req: https_fn.Request) -> https_fn.Response:
    """
    Unsubscribe a user from alerts by disabling their subscription
    Usage: GET /unsubscribe?id=subscription_id
    """
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    if req.method != 'GET':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    try:
        subscription_id = req.args.get('id')
        
        if not subscription_id:
            return https_fn.Response(
                json.dumps({"error": "Subscription ID is required"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        db = get_firestore_client()
        doc_ref = db.collection('subscriptions').document(subscription_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return https_fn.Response(
                json.dumps({"error": "Subscription not found"}),
                status=404,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        # Check if already disabled to avoid double-decrementing
        subscription_data = doc.to_dict()
        already_disabled = subscription_data.get('disabled') is not None
        
        doc_ref.update({
            'disabled': datetime.now(),
            'updated_at': datetime.now()
        })
        
        # Decrement subscriber count only if not already disabled
        if not already_disabled:
            increment_stats(subscribers_delta=-1)
        
        html_response = """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Unsubscribed - TheCannon Alerts</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
                .success { color: #28a745; }
                .logo { height: 40px; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <img src="https://thecannon.ca/wp-content/uploads/2023/12/home-titlecannon.png" alt="TheCannon Logo" class="logo">
            <h1 class="success">✅ Successfully Unsubscribed</h1>
            <p>You have been unsubscribed from TheCannon listing alerts.</p>
            <p>You will no longer receive notifications for new listings.</p>
            <p><a href="https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date">Browse current listings on TheCannon</a></p>
        </body>
        </html>
        """
        
        return https_fn.Response(
            html_response,
            headers={"Content-Type": "text/html", "Access-Control-Allow-Origin": "*"}
        )
        
    except Exception as e:
        print(f"Error in unsubscribe: {e}")
        return https_fn.Response(
            json.dumps({"error": "Internal server error"}),
            status=500,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

@scheduler_fn.on_schedule(schedule="*/5 * * * *", secrets=["MAILGUN_API_KEY", "MAILGUN_DOMAIN"])
def scheduled_listing_ingestion(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Scheduled function that runs every 5 minutes to check for new listings
    """
    try:
        result = ingest_listings_core()
        
        print(
            f"Scheduled ingestion complete: new={result['listings_processed']}, "
            f"sent={result['notifications_sent']}, errors={result['notification_errors']}"
        )
        
        try:
            run_stats = {
                "timestamp": datetime.now(),
                "new_listings_count": result["listings_processed"],
                "notifications_sent": result["notifications_sent"],
                "notification_errors": result["notification_errors"],
                "processed_listings": [listing.get('listing_url') for listing in result.get('listing_data', [])]
            }
            
            db = get_firestore_client()
            db.collection('ingestion_runs').add(run_stats)
            
        except Exception as e:
            print(f"Error saving run statistics: {e}")
            
    except Exception as e:
        print(f"Error in scheduled listing ingestion: {e}")
        raise

def calculate_total_notifications_from_runs():
    """
    Calculate total notifications sent by summing up all ingestion_runs.
    Used for one-time initialization if the counter doesn't exist.
    """
    try:
        db = get_firestore_client()
        runs_ref = db.collection('ingestion_runs')
        total = 0
        
        for doc in runs_ref.stream():
            run_data = doc.to_dict()
            total += run_data.get('notifications_sent', 0)
        
        return total
    except Exception as e:
        print(f"Error calculating notifications from runs: {e}")
        return 0


@https_fn.on_request()
def get_stats(req: https_fn.Request) -> https_fn.Response:
    """Get application statistics including subscriber count and notifications sent.
    
    Uses optimized reads:
    - Subscriber count: Firestore aggregation count() query (server-side)
    - Notifications sent: Counter document (single doc read)
    
    Falls back to counter document for subscribers if aggregation isn't available.
    """
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    try:
        db = get_firestore_client()
        
        # Try to get stats from the counter document first (O(1) read)
        stats_ref = db.collection('metadata').document('stats')
        stats_doc = stats_ref.get()
        stats_data = stats_doc.to_dict() if stats_doc.exists else {}
        
        # Get notifications sent from counter document
        total_notifications_sent = stats_data.get('total_notifications_sent')
        
        # If notifications counter doesn't exist, initialize from historical data (one-time)
        if total_notifications_sent is None:
            print("Notifications counter not found, initializing from historical data...")
            total_notifications_sent = calculate_total_notifications_from_runs()
            stats_ref.set({
                'total_notifications_sent': total_notifications_sent
            }, merge=True)
            print(f"Initialized total_notifications_sent to {total_notifications_sent}")
        
        # Try aggregation count for subscribers (server-side, very fast)
        try:
            from google.cloud.firestore_v1.aggregation import AggregationQuery
            
            subscribers_ref = db.collection('subscriptions')
            subscribers_query = subscribers_ref.where(filter=FieldFilter('disabled', '==', None))
            count_query = subscribers_query.count()
            count_result = count_query.get()
            total_subscribers = count_result[0][0].value
        except Exception as agg_error:
            # Fallback to counter document if aggregation fails
            print(f"Aggregation count failed, using counter: {agg_error}")
            total_subscribers = stats_data.get('total_subscribers', 0)
        
        return https_fn.Response(
            json.dumps({
                'total_subscribers': total_subscribers,
                'total_notifications_sent': total_notifications_sent
            }),
            status=200,
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
        
    except Exception as e:
        print(f"Error getting stats: {e}")
        return https_fn.Response(
            json.dumps({'error': 'Failed to fetch statistics'}),
            status=500,
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )


def get_listings_since(since_datetime):
    """
    Fetch all listings created since the given datetime
    """
    try:
        db = get_firestore_client()
        listings_ref = db.collection('listings')
        query = listings_ref.where('created_at', '>=', since_datetime).order_by('created_at', direction='DESCENDING')
        
        listings = []
        for doc in query.stream():
            listing_data = doc.to_dict()
            listing_data['id'] = doc.id
            listings.append(listing_data)
        
        return listings
    except Exception as e:
        print(f"Error fetching listings since {since_datetime}: {e}")
        return []


def get_subscriptions_for_digest(frequency, current_hour=None):
    """
    Get all active subscriptions with the specified frequency that are due for a digest.
    For daily: subscriptions that haven't been sent a digest today
    For weekly: subscriptions that haven't been sent a digest this week
    
    Args:
        frequency: 'DAILY' or 'WEEKLY'
        current_hour: The current hour (0-23) to match against user's preferred sendTime.
                     If None, all subscriptions for this frequency are returned (for backwards compat).
    """
    try:
        db = get_firestore_client()
        subscriptions_ref = db.collection('subscriptions')
        
        # Get active subscriptions with the specified frequency
        query = subscriptions_ref.where(filter=FieldFilter('disabled', '==', None))
        
        now = datetime.now()
        subscriptions = []
        
        # Default hour is 9 AM if user hasn't specified
        DEFAULT_SEND_HOUR = 9
        
        for doc in query.stream():
            subscription_data = doc.to_dict()
            subscription_data['id'] = doc.id
            
            # Check if subscription has the correct frequency
            sub_frequency = subscription_data.get('frequency', 'REAL_TIME')
            if sub_frequency != frequency:
                continue
            
            # Only process EMAIL subscriptions for digests
            if subscription_data.get('type') != 'EMAIL':
                continue
            
            # Check if the current hour matches the user's preferred send time
            if current_hour is not None:
                send_time = subscription_data.get('sendTime')
                if send_time and send_time.strip():
                    # Parse the sendTime (format: "HH:MM")
                    try:
                        preferred_hour = int(send_time.split(':')[0])
                    except (ValueError, IndexError):
                        preferred_hour = DEFAULT_SEND_HOUR
                else:
                    preferred_hour = DEFAULT_SEND_HOUR
                
                # Skip if current hour doesn't match preferred hour
                if current_hour != preferred_hour:
                    continue
            
            # Check if digest is due
            last_digest = subscription_data.get('lastDigestSentAt')
            
            if last_digest is None:
                # Never sent a digest, include this subscription
                subscriptions.append(subscription_data)
            else:
                # Convert Firestore timestamp to datetime if needed
                if hasattr(last_digest, 'timestamp'):
                    last_digest = datetime.fromtimestamp(last_digest.timestamp())
                
                if frequency == 'DAILY':
                    # Check if last digest was sent more than 23 hours ago
                    if (now - last_digest).total_seconds() > 23 * 3600:
                        subscriptions.append(subscription_data)
                elif frequency == 'WEEKLY':
                    # Check if last digest was sent more than 6.5 days ago
                    if (now - last_digest).total_seconds() > 6.5 * 24 * 3600:
                        subscriptions.append(subscription_data)
        
        return subscriptions
    except Exception as e:
        print(f"Error fetching subscriptions for {frequency} digest: {e}")
        return []


def update_last_digest_sent(subscription_id):
    """
    Update the lastDigestSentAt timestamp for a subscription
    """
    try:
        db = get_firestore_client()
        doc_ref = db.collection('subscriptions').document(subscription_id)
        doc_ref.update({
            'lastDigestSentAt': datetime.now()
        })
        return True
    except Exception as e:
        print(f"Error updating lastDigestSentAt for {subscription_id}: {e}")
        return False


def send_digest_notifications_core(frequency, current_hour=None):
    """
    Core logic for sending digest notifications.
    
    Args:
        frequency: 'DAILY' or 'WEEKLY'
        current_hour: Optional. The current hour (0-23) to filter subscriptions by preferred send time.
                     If None, sends to all subscriptions regardless of their sendTime preference.
    """
    digest_type = frequency.lower()
    
    # Get subscriptions due for digest, filtered by send time if provided
    subscriptions = get_subscriptions_for_digest(frequency, current_hour)
    
    if not subscriptions:
        print(f"No subscriptions due for {digest_type} digest")
        return {"sent": 0, "errors": 0}
    
    # Determine the time window for listings
    now = datetime.now()
    if frequency == 'DAILY':
        since = now - timedelta(days=1)
    else:  # WEEKLY
        since = now - timedelta(days=7)
    
    # Get all listings from the time window
    all_listings = get_listings_since(since)
    
    sent_count = 0
    error_count = 0
    
    # Process each subscription
    for subscription in subscriptions:
        try:
            # Filter listings that match this subscription's preferences
            matching_listings = []
            
            bedroom_prefs = subscription.get('bedroomPreferences')
            if bedroom_prefs is None:
                bedroom_prefs = [subscription.get('bedroomPreference', 'ANY')]
            
            price_prefs = subscription.get('pricePreferences')
            if price_prefs is None:
                price_prefs = [subscription.get('pricePreference', 'ANY')]
            
            for listing in all_listings:
                listing_bedroom_bucket = listing.get('bedroom_bucket')
                listing_price_bucket = listing.get('price_bucket')
                
                bedroom_match = ('ANY' in bedroom_prefs or listing_bedroom_bucket in bedroom_prefs)
                price_match = ('ANY' in price_prefs or listing_price_bucket in price_prefs)
                
                if bedroom_match and price_match:
                    matching_listings.append(listing)
            
            # Send digest even if no matching listings (to confirm subscription is active)
            success = send_digest_email_notification(subscription, matching_listings, digest_type)
            
            if success:
                sent_count += 1
                update_last_digest_sent(subscription['id'])
            else:
                error_count += 1
                
        except Exception as e:
            print(f"Error processing digest for subscription {subscription.get('id')}: {e}")
            error_count += 1
    
    return {"sent": sent_count, "errors": error_count}


@scheduler_fn.on_schedule(schedule="0 * * * *", timezone="America/New_York", secrets=["MAILGUN_API_KEY", "MAILGUN_DOMAIN"])
def scheduled_daily_digest(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Scheduled function that runs every hour to send daily digest emails.
    
    This runs hourly and checks each subscription's preferred sendTime.
    - If a user sets sendTime to "11:00", they'll receive their digest at 11 AM EST
    - If no sendTime is set, the default is 9 AM EST
    
    Example: At 11 AM EST, this will find all DAILY subscribers with sendTime="11:00"
    (or "11:XX") and send them their digest.
    """
    try:
        # Get the current hour in EST (the timezone the function runs in)
        from datetime import datetime
        import pytz
        
        est = pytz.timezone('America/New_York')
        current_hour = datetime.now(est).hour
        
        result = send_digest_notifications_core('DAILY', current_hour)
        
        print(f"Daily digest (hour {current_hour}): sent={result['sent']}, errors={result['errors']}")
        
        # Only log if we actually sent something
        if result["sent"] > 0 or result["errors"] > 0:
            try:
                db = get_firestore_client()
                db.collection('digest_runs').add({
                    "type": "daily",
                    "hour": current_hour,
                    "timestamp": datetime.now(),
                    "sent": result["sent"],
                    "errors": result["errors"]
                })
            except Exception as e:
                print(f"Error saving daily digest run stats: {e}")
            
    except Exception as e:
        print(f"Error in scheduled daily digest: {e}")
        raise


@scheduler_fn.on_schedule(schedule="0 * * * 0", timezone="America/New_York", secrets=["MAILGUN_API_KEY", "MAILGUN_DOMAIN"])
def scheduled_weekly_digest(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Scheduled function that runs every hour on Sundays to send weekly digest emails.
    
    This runs hourly on Sundays and checks each subscription's preferred sendTime.
    - If a user sets sendTime to "11:00", they'll receive their digest at 11 AM EST on Sunday
    - If no sendTime is set, the default is 9 AM EST
    """
    try:
        # Get the current hour in EST (the timezone the function runs in)
        from datetime import datetime
        import pytz
        
        est = pytz.timezone('America/New_York')
        current_hour = datetime.now(est).hour
        
        result = send_digest_notifications_core('WEEKLY', current_hour)
        
        print(f"Weekly digest (hour {current_hour}): sent={result['sent']}, errors={result['errors']}")
        
        # Only log if we actually sent something
        if result["sent"] > 0 or result["errors"] > 0:
            try:
                db = get_firestore_client()
                db.collection('digest_runs').add({
                    "type": "weekly",
                    "hour": current_hour,
                    "timestamp": datetime.now(),
                    "sent": result["sent"],
                    "errors": result["errors"]
                })
            except Exception as e:
                print(f"Error saving weekly digest run stats: {e}")
            
    except Exception as e:
        print(f"Error in scheduled weekly digest: {e}")
        raise


def serialize_firestore_timestamp(value):
    """
    Convert Firestore timestamp to ISO string for JSON serialization.
    """
    if value is None:
        return None
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    if hasattr(value, 'timestamp'):
        return datetime.fromtimestamp(value.timestamp()).isoformat()
    return str(value)


@https_fn.on_request(secrets=["ADMIN_EMAILS"])
def get_all_subscriptions(req: https_fn.Request) -> https_fn.Response:
    """
    Admin endpoint to fetch all subscriptions.
    Requires Firebase Auth ID token verification.
    """
    # Handle CORS preflight
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    if req.method != 'GET':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    # Verify admin authentication
    auth_result = verify_admin_token(req)
    if not auth_result['success']:
        return https_fn.Response(
            json.dumps({'error': auth_result['error']}),
            status=auth_result['status'],
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
    
    try:
        # Fetch all subscriptions from Firestore
        db = get_firestore_client()
        subscriptions = []
        
        for doc in db.collection('subscriptions').stream():
            data = doc.to_dict()
            data['id'] = doc.id
            
            # Skip unverified EMAIL subscriptions (they appear in verifications page instead)
            # Include: WEBHOOK (always verified), verified EMAIL, or legacy subscriptions (isVerified not set)
            if data.get('type') == 'EMAIL' and data.get('isVerified') is False:
                continue
            
            # Convert Firestore timestamps to ISO strings for JSON serialization
            timestamp_fields = ['createdAt', 'disabled', 'lastDigestSentAt', 'updated_at', 'verifiedAt', 'declinedAt']
            for field in timestamp_fields:
                if field in data:
                    data[field] = serialize_firestore_timestamp(data[field])
            
            subscriptions.append(data)
        
        return https_fn.Response(
            json.dumps({'subscriptions': subscriptions}),
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
        
    except Exception as e:
        print(f"Error fetching subscriptions: {e}")
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )


@https_fn.on_request(secrets=["ADMIN_EMAILS"])
def admin_disable_subscription(req: https_fn.Request) -> https_fn.Response:
    """
    Admin endpoint to disable a subscription.
    Similar to unsubscribe but requires admin auth.
    """
    # Handle CORS preflight
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    # Verify admin authentication
    auth_result = verify_admin_token(req)
    if not auth_result['success']:
        return https_fn.Response(
            json.dumps({'error': auth_result['error']}),
            status=auth_result['status'],
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
    
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response(
                json.dumps({"error": "No JSON data provided"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        subscription_id = request_data.get('subscription_id')
        if not subscription_id:
            return https_fn.Response(
                json.dumps({"error": "subscription_id is required"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        db = get_firestore_client()
        doc_ref = db.collection('subscriptions').document(subscription_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return https_fn.Response(
                json.dumps({"error": "Subscription not found"}),
                status=404,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        # Check if already disabled to avoid double-decrementing
        subscription_data = doc.to_dict()
        already_disabled = subscription_data.get('disabled') is not None
        
        # Disable the subscription
        doc_ref.update({
            'disabled': datetime.now(),
            'updated_at': datetime.now()
        })
        
        # Decrement subscriber count only if not already disabled
        if not already_disabled:
            increment_stats(subscribers_delta=-1)
        
        return https_fn.Response(
            json.dumps({"success": True, "message": "Subscription disabled successfully"}),
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
        
    except Exception as e:
        print(f"Error disabling subscription: {e}")
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )


@https_fn.on_request(secrets=["ADMIN_EMAILS"])
def get_pending_verifications(req: https_fn.Request) -> https_fn.Response:
    """
    Admin endpoint to fetch all subscriptions pending verification.
    Returns non-disabled EMAIL subscriptions where isVerified is False.
    """
    # Handle CORS preflight
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    if req.method != 'GET':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    # Verify admin authentication
    auth_result = verify_admin_token(req)
    if not auth_result['success']:
        return https_fn.Response(
            json.dumps({'error': auth_result['error']}),
            status=auth_result['status'],
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
    
    try:
        db = get_firestore_client()
        subscriptions = []
        
        # Query for EMAIL subscriptions that are not disabled and not verified
        # We need to filter in code since Firestore doesn't support != and == in same query well
        for doc in db.collection('subscriptions').stream():
            data = doc.to_dict()
            data['id'] = doc.id
            
            # Only include:
            # - EMAIL type subscriptions
            # - Not disabled
            # - isVerified is explicitly False (not None for legacy support)
            if (data.get('type') == 'EMAIL' and 
                data.get('disabled') is None and 
                data.get('isVerified') is False):
                
                # Convert Firestore timestamps to ISO strings for JSON serialization
                timestamp_fields = ['createdAt', 'disabled', 'lastDigestSentAt', 'updated_at', 'verifiedAt', 'declinedAt']
                for field in timestamp_fields:
                    if field in data:
                        data[field] = serialize_firestore_timestamp(data[field])
                
                subscriptions.append(data)
        
        return https_fn.Response(
            json.dumps({'subscriptions': subscriptions}),
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
        
    except Exception as e:
        print(f"Error fetching pending verifications: {e}")
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )


@https_fn.on_request(secrets=["ADMIN_EMAILS"])
def admin_verify_subscription(req: https_fn.Request) -> https_fn.Response:
    """
    Admin endpoint to verify a subscription.
    Sets isVerified to True for the subscription.
    """
    # Handle CORS preflight
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    # Verify admin authentication
    auth_result = verify_admin_token(req)
    if not auth_result['success']:
        return https_fn.Response(
            json.dumps({'error': auth_result['error']}),
            status=auth_result['status'],
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
    
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response(
                json.dumps({"error": "No JSON data provided"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        subscription_id = request_data.get('subscription_id')
        if not subscription_id:
            return https_fn.Response(
                json.dumps({"error": "subscription_id is required"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        db = get_firestore_client()
        doc_ref = db.collection('subscriptions').document(subscription_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return https_fn.Response(
                json.dumps({"error": "Subscription not found"}),
                status=404,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        # Verify the subscription
        doc_ref.update({
            'isVerified': True,
            'verifiedAt': datetime.now(),
            'updated_at': datetime.now()
        })
        
        return https_fn.Response(
            json.dumps({"success": True, "message": "Subscription verified successfully"}),
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
        
    except Exception as e:
        print(f"Error verifying subscription: {e}")
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )


@https_fn.on_request(secrets=["ADMIN_EMAILS"])
def admin_decline_subscription(req: https_fn.Request) -> https_fn.Response:
    """
    Admin endpoint to decline a subscription verification.
    Sets the subscription to disabled and keeps isVerified as False.
    """
    # Handle CORS preflight
    if req.method == 'OPTIONS':
        return https_fn.Response(
            '',
            headers={
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '3600'
            }
        )
    
    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    # Verify admin authentication
    auth_result = verify_admin_token(req)
    if not auth_result['success']:
        return https_fn.Response(
            json.dumps({'error': auth_result['error']}),
            status=auth_result['status'],
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
    
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response(
                json.dumps({"error": "No JSON data provided"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        subscription_id = request_data.get('subscription_id')
        if not subscription_id:
            return https_fn.Response(
                json.dumps({"error": "subscription_id is required"}),
                status=400,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        db = get_firestore_client()
        doc_ref = db.collection('subscriptions').document(subscription_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return https_fn.Response(
                json.dumps({"error": "Subscription not found"}),
                status=404,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        # Check if already disabled to avoid double-decrementing
        subscription_data = doc.to_dict()
        already_disabled = subscription_data.get('disabled') is not None
        
        # Decline the subscription by disabling it (isVerified stays False)
        doc_ref.update({
            'disabled': datetime.now(),
            'declinedAt': datetime.now(),
            'updated_at': datetime.now()
        })
        
        # Decrement subscriber count only if not already disabled
        if not already_disabled:
            increment_stats(subscribers_delta=-1)
        
        return https_fn.Response(
            json.dumps({"success": True, "message": "Subscription declined successfully"}),
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
        
    except Exception as e:
        print(f"Error declining subscription: {e}")
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
