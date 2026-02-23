import Image from 'next/image';

type SvgIntegration = {
  name: string;
  type: 'svg';
  color: string;
  path: string;
};

type ImgIntegration = {
  name: string;
  type: 'img';
  src: string;
};

type Integration = SvgIntegration | ImgIntegration;

const integrations: Integration[] = [
  {
    name: 'HubSpot',
    type: 'svg',
    color: '#FF7A59',
    path: 'M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z',
  },
  {
    name: 'Pipedrive',
    type: 'img',
    src: '/logos/pipedrive-icon.png',
  },
  {
    name: 'RD Station',
    type: 'img',
    src: '/logos/rdstation-icon.png',
  },
  {
    name: 'Gmail',
    type: 'svg',
    color: '#EA4335',
    path: 'M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z',
  },
  {
    name: 'WhatsApp',
    type: 'svg',
    color: '#25D366',
    path: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  },
  {
    name: 'Google',
    type: 'img',
    src: '/logos/google-logo.png',
  },
];

export function LogoBar() {
  return (
    <section className="border-y border-[var(--border)]/40 bg-[var(--muted)]/30 py-10">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="mb-6 text-sm font-medium text-[var(--muted-foreground)]">
          Integra com as ferramentas que você já usa
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {integrations.map((item) => (
            <div key={item.name} className="flex items-center gap-2.5">
              {item.type === 'img' ? (
                <Image
                  src={item.src}
                  alt={item.name}
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded object-contain"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 shrink-0"
                  fill={item.color}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d={item.path} />
                </svg>
              )}
              <span className="text-sm font-medium text-[var(--muted-foreground)]">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
