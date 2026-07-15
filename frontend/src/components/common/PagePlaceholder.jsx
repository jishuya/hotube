import { Icon } from '@iconify/react';

const PagePlaceholder = ({ title, description, icon }) => (
  <main className="min-h-screen bg-background px-4 pb-16 pt-8 text-text-primary">
    <section className="mx-auto flex min-h-[60vh] max-w-container flex-col items-center justify-center text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon icon={icon} className="text-3xl" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </section>
  </main>
);

export default PagePlaceholder;
