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
} from '@react-email/components';

export interface TheCannonAlertEmailProps {
  price: string;
  bedrooms: string;
  address: string;
  description: string;
  coverImageUrl?: string;
  listingUrl: string;
  subscriptionBedrooms: string;
  subscriptionPriceRange: string;
  postedAtText?: string;
  unsubscribeUrl?: string;
  listingsOverviewUrl?: string;
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
  listingCard: {
    margin: '0 24px 24px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '240px',
    objectFit: 'cover' as const,
    display: 'block',
    borderRadius: '8px',
  },
  imagePlaceholder: {
    width: '100%',
    height: '240px',
    backgroundColor: '#EAB308',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '18px',
    fontWeight: '600',
    borderRadius: '8px',
  },
  cardContent: {
    padding: '24px',
  },
  priceRow: {
    marginBottom: '12px',
  },
  price: {
    color: '#111827',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 4px 0',
  },
  metaText: {
    color: '#6B7280',
    fontSize: '14px',
    margin: '0 0 12px 0',
  },
  address: {
    color: '#111827',
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 16px 0',
  },
  description: {
    color: '#374151',
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
  },
  ctaButton: {
    backgroundColor: '#EAB308',
    borderRadius: '8px',
    color: '#FFFFFF',
    display: 'inline-block',
    fontSize: '16px',
    fontWeight: '600',
    padding: '14px 28px',
    textAlign: 'center' as const,
    textDecoration: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  subscriptionSection: {
    backgroundColor: '#F9FAFB',
    padding: '24px',
    margin: '24px 0 0 0',
  },
  subscriptionTitle: {
    color: '#111827',
    fontSize: '16px',
    fontWeight: '600',
    margin: '0 0 12px 0',
  },
  filterPills: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  filterPill: {
    backgroundColor: '#E5E7EB',
    borderRadius: '20px',
    color: '#374151',
    fontSize: '14px',
    padding: '6px 12px',
    display: 'inline-block',
  },
  footer: {
    backgroundColor: '#F9FAFB',
    padding: '24px',
    textAlign: 'center' as const,
  },
  footerText: {
    color: '#6B7280',
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '0 0 8px 0',
  },
  footerLink: {
    color: '#38BDF8',
    textDecoration: 'none',
    fontSize: '14px',
  },
  spacer: {
    height: '8px',
  },
};

export default function TheCannonAlertEmail({
  price,
  bedrooms,
  address,
  description,
  coverImageUrl,
  listingUrl,
  subscriptionBedrooms,
  subscriptionPriceRange,
  postedAtText,
  unsubscribeUrl = '#',
  listingsOverviewUrl = 'https://thecannon.ca/housing/?wanted_forsale=forsale&sortby=date',
}: TheCannonAlertEmailProps) {
  const previewText = `New listing on TheCannon matches your alerts: ${price} - ${bedrooms} - ${address}`;
  
  const truncatedDescription = description.length > 200 
    ? description.substring(0, 197) + '...' 
    : description;

  return (
    <Html>
      <Head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.headerTitle}>
              New TheCannon Listing Match!
            </Text>
          </Section>

          <Section style={styles.cardContent}>
            <Text style={styles.price}>{price} / month</Text>

            <Text style={styles.metaText}>
              {bedrooms}{postedAtText ? ` - ${postedAtText}` : ''}
            </Text>

            <Text style={styles.address}>{address}</Text>

            {coverImageUrl ? (
              <Img
                src={coverImageUrl}
                alt="Listing photo"
                style={styles.coverImage}
              />
            ) : (
              <Section style={styles.imagePlaceholder}>
                <Text style={{ margin: 0, color: '#FFFFFF', fontSize: '18px', fontWeight: '600' }}>
                  New listing on TheCannon
                </Text>
              </Section>
            )}

            <Text style={styles.description}>{truncatedDescription}</Text>

            <Button href={listingUrl} style={styles.ctaButton}>
              View listing on TheCannon
            </Button>
          </Section>

          <Section style={styles.subscriptionSection}>
            <Text style={styles.subscriptionTitle}>Your alert filters</Text>
            <Text style={styles.filterPill}>
              Bedrooms: {subscriptionBedrooms} - Price: {subscriptionPriceRange}
            </Text>
          </Section>

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You&apos;re receiving this email because you subscribed to TheCannon Alerts.
            </Text>
            <Link href={unsubscribeUrl} style={styles.footerLink}>
              Unsubscribe
            </Link>
            <Text style={styles.footerText}> - </Text>
            <Link href={listingsOverviewUrl} style={styles.footerLink}>
              View more listings
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
