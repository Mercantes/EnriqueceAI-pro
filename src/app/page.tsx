import { FeaturesSection } from './_landing/FeaturesSection';
import { HeroWithForm } from './_landing/HeroWithForm';
import { LandingFooter } from './_landing/LandingFooter';
import { LogoBar } from './_landing/LogoBar';
import { MetricsSection } from './_landing/MetricsSection';
import { SalesEngagementSection } from './_landing/SalesEngagementSection';
import { SmoothScroll } from './_landing/SmoothScroll';

export default function Home() {
  return (
    <main>
      <SmoothScroll />
      <HeroWithForm />
      <LogoBar />
      <SalesEngagementSection />
      <MetricsSection />
      <FeaturesSection />
      <LandingFooter />
    </main>
  );
}
