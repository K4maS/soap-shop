import { PrismaClient } from '@prisma/client';

// =============================================================
// Seed: product categories for Mylo Master soap/cosmetics shop
// =============================================================

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    name: 'Мыльная основа белая',
    slug: 'soap-base-white',
    description:
      'Белая непрозрачная мыльная основа для изготовления мыла ручной работы. Хорошо пенится, мягко очищает кожу.',
    sortOrder: 1,
  },
  {
    name: 'Мыльная основа прозрачная',
    slug: 'soap-base-transparent',
    description:
      'Прозрачная глицериновая мыльная основа. Идеальна для мыла с декором и ботаническими включениями.',
    sortOrder: 2,
  },
  {
    name: 'Основа для шампуня',
    slug: 'shampoo-base',
    description:
      'Готовая основа для изготовления шампуней с различными активными добавками.',
    sortOrder: 3,
  },
  {
    name: 'Основа для геля душа',
    slug: 'shower-gel-base',
    description:
      'Нейтральная база для создания гелей для душа, пены для ванны и жидкого мыла.',
    sortOrder: 4,
  },
  {
    name: 'Мыло-масса',
    slug: 'soap-mass',
    description:
      'Готовая мыльная масса для лепки и создания фигурного мыла. Мягкая, пластичная консистенция.',
    sortOrder: 5,
  },
  {
    name: 'Комплексы масел',
    slug: 'oil-complexes',
    description:
      'Натуральные масляные комплексы для обогащения мыльных основ и косметических средств.',
    sortOrder: 6,
  },
  {
    name: 'Отдушки',
    slug: 'fragrances',
    description:
      'Ароматические отдушки и эфирные масла для парфюмирования мыла и косметики.',
    sortOrder: 7,
  },
  {
    name: 'Красители',
    slug: 'colorants',
    description:
      'Косметические красители, слюды и пигменты для окрашивания мыла, бомб и кремов.',
    sortOrder: 8,
  },
  {
    name: 'Формы',
    slug: 'molds',
    description:
      'Силиконовые, пластиковые и поликарбонатные формы для отливки мыла.',
    sortOrder: 9,
  },
] as const;

async function main(): Promise<void> {
  console.log('Seeding categories...');

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    });

    console.log(`  ✓ ${category.name} (${category.slug})`);
  }

  console.log(`Done: ${CATEGORIES.length} categories seeded.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
