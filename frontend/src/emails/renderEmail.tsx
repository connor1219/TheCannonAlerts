import { renderToStaticMarkup } from 'react-dom/server';
import TheCannonAlertEmail, { TheCannonAlertEmailProps } from './TheCannonAlertEmail';
import TheCannonDigestEmail, { TheCannonDigestEmailProps } from './TheCannonDigestEmail';

/**
 * Renders the TheCannon alert email template to HTML string
 */
export function renderTheCannonAlertEmail(props: TheCannonAlertEmailProps): string {
  const html = renderToStaticMarkup(<TheCannonAlertEmail {...props} />);
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${html}`;
}

/**
 * Renders the TheCannon digest email template to HTML string
 */
export function renderTheCannonDigestEmail(props: TheCannonDigestEmailProps): string {
  const html = renderToStaticMarkup(<TheCannonDigestEmail {...props} />);
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${html}`;
}

const BEDROOM_LABELS: Record<string, string> = {
  'B1': '1 bedroom',
  'B2': '2 bedrooms',
  'B3': '3 bedrooms',
  'B4': '4 bedrooms',
  'B5_PLUS': '5+ bedrooms',
};

function getReadableBedrooms(bucket: string): string {
  return BEDROOM_LABELS[bucket] || 'Any bedrooms';
}

function formatPriceRange(minPrice?: number | null, maxPrice?: number | null): string {
  if (minPrice == null && maxPrice == null) return 'Any price';
  if (minPrice != null && maxPrice == null) return `$${minPrice.toLocaleString()}+`;
  if (minPrice == null && maxPrice != null) return `Up to $${maxPrice!.toLocaleString()}`;
  return `$${minPrice!.toLocaleString()} - $${maxPrice!.toLocaleString()}`;
}

/**
 * Helper function to convert listing data and subscription data to email props
 */
export function createEmailPropsFromListing(
  listingData: any,
  subscription: any
): TheCannonAlertEmailProps {
  const bedroomPrefs: string[] = subscription.bedroomPreferences || ['ANY'];
  const subscriptionBedrooms = bedroomPrefs.includes('ANY')
    ? 'Any'
    : bedroomPrefs.map(getReadableBedrooms).join(', ');

  return {
    price: listingData.price_string || `$${listingData.price_int}`,
    bedrooms: getReadableBedrooms(listingData.bedroom_bucket),
    address: listingData.address || 'Address not available',
    description: listingData.description || 'No description available',
    coverImageUrl: listingData.image_url,
    listingUrl: listingData.listing_url,
    subscriptionBedrooms,
    subscriptionPriceRange: formatPriceRange(subscription.minPrice, subscription.maxPrice),
    postedAtText: 'Posted today',
    unsubscribeUrl: `https://thecannonalerts.ca/unsubscribe?id=${encodeURIComponent(subscription.id)}`,
    listingsOverviewUrl: 'https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date',
  };
}


