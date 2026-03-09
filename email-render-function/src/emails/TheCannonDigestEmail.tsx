import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Img,
  Text,
  Button,
  Link,
  Row,
  Column,
} from '@react-email/components';

export interface ListingItem {
  price: string;
  bedrooms: string;
  address: string;
  coverImageUrl?: string;
  listingUrl: string;
  dateAvailable?: string;
  features?: string[];
}

export interface TheCannonDigestEmailProps {
  listings: ListingItem[];
  digestType: 'daily' | 'weekly';
  subscriptionBedrooms: string;
  subscriptionPriceRange: string;
  unsubscribeUrl?: string;
  listingsOverviewUrl?: string;
  periodStart?: string;
  periodEnd?: string;
}

const baseFontFamily = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const styles = {
  body: {
    backgroundColor: '#F3F4F6',
    fontFamily: baseFontFamily,
    margin: 0,
    padding: 0,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    margin: '20px auto',
    maxWidth: '600px',
    overflow: 'hidden',
  },
  header: {
    textAlign: 'center' as const,
    padding: '24px',
    backgroundColor: '#EAB308',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: '24px',
    fontWeight: '700',
    lineHeight: '1.2',
    margin: '0',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    fontWeight: '500',
    margin: '8px 0 0 0',
  },
  summarySection: {
    padding: '20px 24px',
    backgroundColor: '#FAFAFA',
    borderBottom: '1px solid #E5E7EB',
  },
  summaryText: {
    color: '#374151',
    fontSize: '16px',
    lineHeight: '1.5',
    margin: '0',
    textAlign: 'center' as const,
  },
  summaryHighlight: {
    color: '#EAB308',
    fontWeight: '700',
    fontSize: '20px',
  },
  gallerySection: {
    padding: '16px 24px',
  },
  galleryTitle: {
    color: '#111827',
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 16px 0',
    paddingBottom: '12px',
    borderBottom: '2px solid #EAB308',
  },
  listingCard: {
    marginBottom: '16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  listingRow: {
    width: '100%',
  },
  listingImageCol: {
    width: '140px',
    verticalAlign: 'top',
  },
  listingImage: {
    width: '140px',
    height: '105px',
    objectFit: 'cover' as const,
    display: 'block',
  },
  listingImagePlaceholder: {
    width: '140px',
    height: '105px',
    backgroundColor: '#EAB308',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingContentCol: {
    verticalAlign: 'top',
    padding: '12px 16px',
  },
  listingPrice: {
    color: '#111827',
    fontSize: '18px',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  listingBedrooms: {
    color: '#6B7280',
    fontSize: '13px',
    margin: '0 0 6px 0',
  },
  listingAddress: {
    color: '#374151',
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 8px 0',
    lineHeight: '1.3',
  },
  listingFeatures: {
    color: '#6B7280',
    fontSize: '12px',
    margin: '0',
    lineHeight: '1.4',
  },
  viewButton: {
    backgroundColor: '#EAB308',
    borderRadius: '6px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: '600',
    padding: '8px 14px',
    textDecoration: 'none',
  },
  ctaSection: {
    padding: '24px',
    textAlign: 'center' as const,
    backgroundColor: '#FAFAFA',
    borderTop: '1px solid #E5E7EB',
  },
  ctaButton: {
    backgroundColor: '#EAB308',
    borderRadius: '8px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: '600',
    padding: '14px 32px',
    textDecoration: 'none',
  },
  subscriptionSection: {
    backgroundColor: '#F9FAFB',
    padding: '20px 24px',
    borderTop: '1px solid #E5E7EB',
  },
  subscriptionTitle: {
    color: '#111827',
    fontSize: '14px',
    fontWeight: '600',
    margin: '0 0 8px 0',
  },
  filterPill: {
    backgroundColor: '#E5E7EB',
    borderRadius: '20px',
    color: '#374151',
    fontSize: '13px',
    padding: '6px 12px',
    display: 'inline-block',
  },
  footer: {
    backgroundColor: '#F9FAFB',
    padding: '20px 24px',
    textAlign: 'center' as const,
    borderTop: '1px solid #E5E7EB',
  },
  footerText: {
    color: '#6B7280',
    fontSize: '13px',
    lineHeight: '1.5',
    margin: '0 0 8px 0',
  },
  footerLink: {
    color: '#38BDF8',
    textDecoration: 'none',
    fontSize: '13px',
  },
  noListingsSection: {
    padding: '40px 24px',
    textAlign: 'center' as const,
  },
  noListingsText: {
    color: '#6B7280',
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0',
  },
};

export default function TheCannonDigestEmail({
  listings,
  digestType,
  subscriptionBedrooms,
  subscriptionPriceRange,
  unsubscribeUrl = '#',
  listingsOverviewUrl = 'https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date',
  periodStart,
  periodEnd,
}: TheCannonDigestEmailProps) {
  const listingCount = listings.length;
  const periodText = digestType === 'daily' ? 'today' : 'this week';
  const digestTitle = digestType === 'daily' ? 'Daily Digest' : 'Weekly Digest';
  
  const previewText = listingCount > 0 
    ? `${listingCount} new listing${listingCount === 1 ? '' : 's'} match${listingCount === 1 ? 'es' : ''} your alerts ${periodText}`
    : `No new listings matched your alerts ${periodText}`;

  return (
    <Html>
      <Head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.headerTitle}>
              TheCannon {digestTitle}
            </Text>
            {periodStart && periodEnd && (
              <Text style={styles.headerSubtitle}>
                {periodStart} - {periodEnd}
              </Text>
            )}
          </Section>

          {/* Summary */}
          <Section style={styles.summarySection}>
            <Text style={styles.summaryText}>
              <span style={styles.summaryHighlight}>{listingCount}</span>{' '}
              new listing{listingCount === 1 ? '' : 's'} matched your filters {periodText}
            </Text>
          </Section>

          {/* Listings Gallery */}
          {listingCount > 0 ? (
            <Section style={styles.gallerySection}>
              <Text style={styles.galleryTitle}>
                New Listings
              </Text>
              
              {listings.map((listing, index) => (
                <Section key={index} style={styles.listingCard}>
                  <Row style={styles.listingRow}>
                    <Column style={styles.listingImageCol}>
                      {listing.coverImageUrl ? (
                        <Img
                          src={listing.coverImageUrl}
                          alt={`Listing at ${listing.address}`}
                          style={styles.listingImage}
                        />
                      ) : (
                        <Section style={styles.listingImagePlaceholder}>
                          <Text style={{ margin: 0, color: '#FFFFFF', fontSize: '11px', fontWeight: '600', textAlign: 'center' as const }}>
                            No Image
                          </Text>
                        </Section>
                      )}
                    </Column>
                    <Column style={styles.listingContentCol}>
                      <Text style={styles.listingPrice}>{listing.price}/mo</Text>
                      <Text style={styles.listingBedrooms}>{listing.bedrooms}</Text>
                      <Text style={styles.listingAddress}>{listing.address}</Text>
                      {listing.dateAvailable && (
                        <Text style={styles.listingFeatures}>
                          Available: {listing.dateAvailable}
                        </Text>
                      )}
                      <Button href={listing.listingUrl} style={styles.viewButton}>
                        View Listing
                      </Button>
                    </Column>
                  </Row>
                </Section>
              ))}
            </Section>
          ) : (
            <Section style={styles.noListingsSection}>
              <Text style={styles.noListingsText}>
                No new listings matched your filters {periodText}.<br />
                We&apos;ll keep monitoring and notify you when new listings appear!
              </Text>
            </Section>
          )}

          {/* CTA Section */}
          <Section style={styles.ctaSection}>
            <Button href={listingsOverviewUrl} style={styles.ctaButton}>
              Browse All Listings on TheCannon
            </Button>
          </Section>

          {/* Subscription Info */}
          <Section style={styles.subscriptionSection}>
            <Text style={styles.subscriptionTitle}>Your alert filters</Text>
            <Text style={styles.filterPill}>
              Bedrooms: {subscriptionBedrooms} • Price: {subscriptionPriceRange}
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You&apos;re receiving this {digestType} digest because you subscribed to TheCannon Alerts.
            </Text>
            <Link href={unsubscribeUrl} style={styles.footerLink}>
              Unsubscribe
            </Link>
            <Text style={styles.footerText}> • </Text>
            <Link href={listingsOverviewUrl} style={styles.footerLink}>
              View more listings
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
