import { renderToStaticMarkup } from 'react-dom/server';
import TheCannonAlertEmail, { TheCannonAlertEmailProps } from './TheCannonAlertEmail';

/**
 * Renders the TheCannon alert email template to HTML string
 */
export function renderTheCannonAlertEmail(props: TheCannonAlertEmailProps): string {
  const html = renderToStaticMarkup(<TheCannonAlertEmail {...props} />);
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">${html}`;
}

/**
 * Helper function to convert listing data and subscription data to email props
 */
export function createEmailPropsFromListing(
  listingData: any,
  subscription: any
): TheCannonAlertEmailProps {
  const getReadableBedrooms = (bucket: string): string => {
    switch (bucket) {
      case 'B1': return '1 bedroom';
      case 'B2': return '2 bedrooms';
      case 'B3': return '3 bedrooms';
      case 'B4': return '4 bedrooms';
      case 'B5_PLUS': return '5+ bedrooms';
      default: return 'Any bedrooms';
    }
  };

  const getReadablePriceRange = (bucket: string): string => {
    switch (bucket) {
      case 'P0_399': return '$0-399';
      case 'P400_699': return '$400-699';
      case 'P700_999': return '$700-999';
      case 'P1000_1499': return '$1000-1499';
      case 'P1500_PLUS': return '$1500+';
      default: return 'Any price';
    }
  };

  const getSubscriptionBedrooms = (pref: string): string => {
    if (pref === 'ANY') return 'Any';
    return getReadableBedrooms(pref);
  };

  const getSubscriptionPriceRange = (pref: string): string => {
    if (pref === 'ANY') return 'Any price';
    return getReadablePriceRange(pref);
  };

  return {
    price: listingData.price_string || `$${listingData.price_int}`,
    bedrooms: getReadableBedrooms(listingData.bedroom_bucket),
    address: listingData.address || 'Address not available',
    description: listingData.description || 'No description available',
    coverImageUrl: listingData.image_url,
    listingUrl: listingData.listing_url,
    subscriptionBedrooms: getSubscriptionBedrooms(subscription.bedroomPreference),
    subscriptionPriceRange: getSubscriptionPriceRange(subscription.pricePreference),
    postedAtText: 'Posted today',
    unsubscribeUrl: `https://thecannonalerts.ca/unsubscribe?id=${encodeURIComponent(subscription.id)}`,
    listingsOverviewUrl: 'https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date',
  };
}


