import React, { useState } from 'react';
import Head from 'next/head';
import { Container, Box } from '@mui/material';
import { Notifications, People } from '@mui/icons-material';
import { HeroSection } from '../components/HeroSection';
import { SubscriptionCard } from '../components/SubscriptionCard';
import { SuccessMessage } from '../components/SuccessMessage';
import { Footer } from '../components/Footer';
import { StatCard } from '../components/StatCard';
import { SubscriptionFormData } from '../schemas/subscriptionSchema';
import { useStats } from '../hooks/useStats';

export default function Home() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState<SubscriptionFormData | null>(null);
  const { stats, loading: statsLoading, refetch: refetchStats } = useStats();

  const handleSubmit = async (data: SubscriptionFormData) => {
    setSubmittedData(data);
    setIsSubmitted(true);
    // Refetch stats after successful subscription
    try {
      await refetchStats();
    } catch (error) {
      console.error('Failed to refetch stats:', error);
    }
  };

  const handleReset = () => {
    setIsSubmitted(false);
    setSubmittedData(null);
  };

  return (
    <>
      <Head>
        <title>TheCannon Alerts - Get Notified of New Guelph Rentals</title>
        <meta 
          name="description" 
          content="Get instant notifications when new Guelph rental listings hit TheCannon that match your budget and bedroom preferences." 
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/theCannon.png" />
      </Head>

      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'background.default',
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.05) 0%, transparent 50%)',
        }}
      >
        <Container maxWidth="lg" sx={{ flex: 1, py: { xs: 4, md: 6 } }}>
          <Box sx={{ maxWidth: 'sm', mx: 'auto', mb: 4 }}>
            <HeroSection />
          </Box>

          <Box sx={{ position: 'relative', minHeight: '500px' }}>
            <Box sx={{ 
              display: { xs: 'none', md: 'flex' },
              position: 'absolute',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 'calc(50% - 260px)',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <StatCard
                title="Notifications Sent"
                value={stats?.totalNotificationsSent || null}
                loading={statsLoading}
                icon={<Notifications sx={{ fontSize: 32 }} />}
              />
            </Box>

            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              minHeight: '500px'
            }}>
              <Box sx={{ maxWidth: 520, width: '100%' }}>
                {isSubmitted && submittedData ? (
                  <SuccessMessage
                    contactMethod={submittedData.type}
                    onReset={handleReset}
                  />
                ) : (
                  <SubscriptionCard onSubmit={handleSubmit} />
                )}
              </Box>
            </Box>

            <Box sx={{ 
              display: { xs: 'none', md: 'flex' },
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 'calc(50% - 260px)',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <StatCard
                title="Active Subscribers"
                value={stats?.totalSubscribers || null}
                loading={statsLoading}
                icon={<People sx={{ fontSize: 32 }} />}
              />
            </Box>
          </Box>

          <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 4, textAlign: 'center' }}>
            <Box sx={{ mb: 3 }}>
              <StatCard
                title="Notifications Sent"
                value={stats?.totalNotificationsSent || null}
                loading={statsLoading}
                icon={<Notifications sx={{ fontSize: 24 }} />}
              />
            </Box>
            <Box>
              <StatCard
                title="Active Subscribers"
                value={stats?.totalSubscribers || null}
                loading={statsLoading}
                icon={<People sx={{ fontSize: 24 }} />}
              />
            </Box>
          </Box>
        </Container>

        <Footer />
      </Box>
    </>
  );
}