from firebase_functions import https_fn, scheduler_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import requests
from bs4 import BeautifulSoup
import re
import json
import urllib.parse
from datetime import datetime
import time
import os

set_global_options(max_instances=10)

initialize_app()

def get_firestore_client():
    """Get Firestore client instance"""
    return firestore.client()

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
    Fetch all active (non-disabled) subscriptions from Firestore
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
                active_subscriptions.append(subscription_data)
        
        return active_subscriptions
    
    except Exception as e:
        print(f"Error fetching active subscriptions: {e}")
        return []

def find_matching_subscriptions(listing_data):
    """
    Find subscriptions that match the given listing.
    Supports both legacy single-value preferences and new array-based preferences.
    """
    matching_subscriptions = []
    active_subscriptions = get_active_subscriptions()
    
    listing_bedroom_bucket = listing_data.get('bedroom_bucket')
    listing_price_bucket = listing_data.get('price_bucket')
    
    for subscription in active_subscriptions:
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

def send_notifications_for_listing(listing_data):
    """
    Find matching subscriptions and send notifications
    """
    try:
        matching_subscriptions = find_matching_subscriptions(listing_data)
        
        if not matching_subscriptions:
            return {"sent": 0, "errors": 0}
        
        sent_count = 0
        error_count = 0
        
        for subscription in matching_subscriptions:
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

    response_data = {
        "listings_processed": len(listing_data),
        "listing_data": listing_data,
        "notifications_sent": notification_summary["total_sent"],
        "notification_errors": notification_summary["total_errors"]
    }
    
    return response_data

@https_fn.on_request(secrets=["MAILGUN_API_KEY", "MAILGUN_DOMAIN"])
def ingest_listings(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP endpoint for manual listing ingestion
    """
    try:
        result = ingest_listings_core()
        return https_fn.Response(
            json.dumps(result),
            headers={"Content-Type": "application/json"}
        )
    except Exception as e:
        print(f"Error in HTTP ingest_listings: {e}")
        return https_fn.Response(
            json.dumps({"error": "Internal server error"}),
            status=500,
            headers={"Content-Type": "application/json"}
        )

@https_fn.on_request()
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
        "userId": "optional-user-id" (for user-based doc IDs)
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
                        "error": "You already have an active subscription with these preferences",
                        "existing_subscription_id": existing_subscription_result["subscription_id"]
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

def validate_subscription_data(data):
    """
    Validate subscription data
    Returns: {"error": None} if valid, {"error": "message"} if invalid
    Supports both legacy single-value and new array-based preferences.
    """
    
    VALID_TYPES = ["EMAIL", "WEBHOOK"]
    VALID_BEDROOM_PREFS = ["ANY", "B1", "B2", "B3", "B4", "B5_PLUS"]
    VALID_PRICE_PREFS = ["ANY", "P0_399", "P400_699", "P700_999", "P1000_1499", "P1500_PLUS"]
    
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
    
    return {"error": None}

def check_existing_subscription(data):
    """
    Check if a subscription already exists for the same email/webhook and preferences.
    Supports both legacy single-value and new array-based preferences.
    Returns: {"exists": bool, "disabled": bool, "subscription_id": str}
    """
    try:
        db = get_firestore_client()
        subscriptions_ref = db.collection('subscriptions')
        
        # Query by email/webhook and type only, then filter by preferences in code
        # (Firestore doesn't support array equality queries well)
        if data["type"] == "EMAIL":
            query = subscriptions_ref.where('email', '==', data["email"])
        else:
            query = subscriptions_ref.where('webhookUrl', '==', data["webhookUrl"])
        
        query = query.where('type', '==', data["type"])
        
        # Get the preferences from the incoming data (support both formats)
        incoming_bedroom_prefs = data.get("bedroomPreferences")
        if incoming_bedroom_prefs is None:
            incoming_bedroom_prefs = [data.get("bedroomPreference", "ANY")]
        incoming_bedroom_prefs = sorted(incoming_bedroom_prefs)
        
        incoming_price_prefs = data.get("pricePreferences")
        if incoming_price_prefs is None:
            incoming_price_prefs = [data.get("pricePreference", "ANY")]
        incoming_price_prefs = sorted(incoming_price_prefs)
        
        docs = query.stream()
        
        for doc in docs:
            subscription_data = doc.to_dict()
            
            # Get existing subscription's preferences (support both formats)
            existing_bedroom_prefs = subscription_data.get('bedroomPreferences')
            if existing_bedroom_prefs is None:
                existing_bedroom_prefs = [subscription_data.get('bedroomPreference', 'ANY')]
            existing_bedroom_prefs = sorted(existing_bedroom_prefs)
            
            existing_price_prefs = subscription_data.get('pricePreferences')
            if existing_price_prefs is None:
                existing_price_prefs = [subscription_data.get('pricePreference', 'ANY')]
            existing_price_prefs = sorted(existing_price_prefs)
            
            # Check if preferences match
            if existing_bedroom_prefs == incoming_bedroom_prefs and existing_price_prefs == incoming_price_prefs:
                disabled_timestamp = subscription_data.get('disabled')
                return {
                    "exists": True,
                    "disabled": disabled_timestamp is not None,
                    "subscription_id": doc.id
                }
        
        return {"exists": False, "disabled": False, "subscription_id": None}
        
    except Exception as e:
        print(f"Error checking existing subscription: {e}")
        return {"exists": False, "disabled": False, "subscription_id": None}

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
    
    subscription_data = {
        "type": data["type"],
        "email": data.get("email"),
        "webhookUrl": data.get("webhookUrl"),
        "bedroomPreferences": bedroom_prefs,
        "pricePreferences": price_prefs,
        "disabled": None,
        "createdAt": datetime.now()
    }
    
    db = get_firestore_client()
    doc_ref = db.collection('subscriptions').add(subscription_data)

    return doc_ref[1].id

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
        
        doc_ref.update({
            'disabled': datetime.now(),
            'updated_at': datetime.now()
        })
        
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

@https_fn.on_request()
def get_stats(req: https_fn.Request) -> https_fn.Response:
    """Get application statistics including unique subscriber count and notifications sent."""
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
        
        # Count unique subscribers by email and webhook URL
        subscribers_ref = db.collection('subscriptions')
        subscribers_query = subscribers_ref.where(filter=FieldFilter('disabled', '==', None))
        
        unique_emails = set()
        unique_webhooks = set()
        
        for doc in subscribers_query.stream():
            subscription_data = doc.to_dict()
            email = subscription_data.get('email')
            webhook_url = subscription_data.get('webhookUrl')
            
            if email:
                unique_emails.add(email.lower())
            if webhook_url:
                unique_webhooks.add(webhook_url)
        
        # Total unique subscribers = unique emails + unique webhooks
        total_subscribers = len(unique_emails) + len(unique_webhooks)
        
        ingestion_runs_ref = db.collection('ingestion_runs')
        total_notifications_sent = 0
        
        for run_doc in ingestion_runs_ref.stream():
            run_data = run_doc.to_dict()
            if run_data and 'notifications_sent' in run_data:
                total_notifications_sent += run_data.get('notifications_sent', 0)
        
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