import { FeaturesSection } from './_landing/FeaturesSection';
import { HeroWithForm } from './_landing/HeroWithForm';
import { LandingFooter } from './_landing/LandingFooter';
import { LogoBar } from './_landing/LogoBar';

export default function Home() {
  return (
    <main>
      <HeroWithForm />
      <LogoBar />
      <FeaturesSection />
      <LandingFooter />
    </main>
  );
}
