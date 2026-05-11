import { PrismaClient } from '@prisma/client';

// =============================================================
// Seed: 15 sample products for Mylo Master
// Prices are in kopecks: 45000 = 450.00 RUB
// =============================================================

const prisma = new PrismaClient();

interface ProductSeed {
  sku: string;
  slug: string;
  name: string;
  description: string;
  priceKopecks: number;
  stockQuantity: number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  weightGrams: number | null;
  unit: string;
  categorySlug: string;
  isActive: boolean;
  isFeatured: boolean;
  tags: string[];
}

const PRODUCTS: ProductSeed[] = [
  // ─── Мыльная основа белая ────────────────────────────────────
  {
    sku: 'SBW-001',
    slug: 'mylo-osnova-belaya-1kg',
    name: 'Мыльная основа белая Premium 1 кг',
    description:
      'Профессиональная белая мыльная основа без SLS/SLES. Мягкая, кремообразная пена. Рекомендуется для изготовления детского и чувствительного мыла. Плавится при 60-65°C. Подходит для добавления красителей и отдушек.',
    priceKopecks: 45000,  // 450 RUB
    stockQuantity: 500,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 1000,
    unit: 'кг',
    categorySlug: 'soap-base-white',
    isActive: true,
    isFeatured: true,
    tags: ['без SLS', 'детское', 'чувствительная кожа'],
  },
  {
    sku: 'SBW-002',
    slug: 'mylo-osnova-belaya-5kg',
    name: 'Мыльная основа белая Premium 5 кг',
    description:
      'Экономичная фасовка белой мыльной основы Premium. Состав идентичен фасовке 1 кг. Оптимально для регулярного производства.',
    priceKopecks: 200000, // 2000 RUB
    stockQuantity: 200,
    minOrderQuantity: 1,
    maxOrderQuantity: 50,
    weightGrams: 5000,
    unit: 'кг',
    categorySlug: 'soap-base-white',
    isActive: true,
    isFeatured: false,
    tags: ['опт', 'без SLS'],
  },

  // ─── Мыльная основа прозрачная ───────────────────────────────
  {
    sku: 'SBT-001',
    slug: 'mylo-osnova-prozrachnaya-1kg',
    name: 'Мыльная основа прозрачная Glycerin 1 кг',
    description:
      'Прозрачная глицериновая мыльная основа высокой степени прозрачности. Степень прозрачности >90%. Идеальна для создания мыла с декором: цветами, игрушками, ботаническими включениями.',
    priceKopecks: 52000,  // 520 RUB
    stockQuantity: 400,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 1000,
    unit: 'кг',
    categorySlug: 'soap-base-transparent',
    isActive: true,
    isFeatured: true,
    tags: ['глицерин', 'прозрачная', 'декор'],
  },

  // ─── Основа для шампуня ──────────────────────────────────────
  {
    sku: 'SHB-001',
    slug: 'osnova-dlya-shampinya-neutral-1l',
    name: 'Основа для шампуня нейтральная 1 л',
    description:
      'Готовая основа для шампуня на основе мягких ПАВ (Coco Glucoside + Sodium Cocoamphoacetate). pH 5.5-6.5. Подходит для всех типов волос. Легко загущается с помощью NaCl.',
    priceKopecks: 38000,  // 380 RUB
    stockQuantity: 300,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 1000,
    unit: 'л',
    categorySlug: 'shampoo-base',
    isActive: true,
    isFeatured: false,
    tags: ['мягкие ПАВ', 'pH 5.5', 'все типы волос'],
  },
  {
    sku: 'SHB-002',
    slug: 'osnova-dlya-shampinya-keratin-1l',
    name: 'Основа для шампуня с кератином 1 л',
    description:
      'Шампуневая основа, обогащённая гидролизованным кератином. Восстанавливает структуру повреждённых волос, повышает блеск. Рекомендуется для окрашенных и химически обработанных волос.',
    priceKopecks: 55000,  // 550 RUB
    stockQuantity: 150,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 1000,
    unit: 'л',
    categorySlug: 'shampoo-base',
    isActive: true,
    isFeatured: true,
    tags: ['кератин', 'восстановление', 'окрашенные волосы'],
  },

  // ─── Основа для геля душа ────────────────────────────────────
  {
    sku: 'SGB-001',
    slug: 'osnova-dlya-gelya-dusha-1l',
    name: 'Основа для геля душа прозрачная 1 л',
    description:
      'Лёгкая прозрачная основа для геля для душа. Хорошо пенится, легко смывается. Основа на кокогликозиде, не содержит SLS/SLES. Слегка загущена ксантановой камедью.',
    priceKopecks: 35000,  // 350 RUB
    stockQuantity: 250,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 1000,
    unit: 'л',
    categorySlug: 'shower-gel-base',
    isActive: true,
    isFeatured: false,
    tags: ['без SLS', 'прозрачный', 'натуральный'],
  },

  // ─── Мыло-масса ──────────────────────────────────────────────
  {
    sku: 'SMA-001',
    slug: 'mylo-massa-belaya-500g',
    name: 'Мыло-масса белая 500 г',
    description:
      'Пластичная мыльная масса для лепки. Не требует плавления. Идеально подходит для создания фигурного мыла, декоративных элементов и мозаики. Поверхность мягкая, приятная на ощупь.',
    priceKopecks: 42000,  // 420 RUB
    stockQuantity: 200,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 500,
    unit: 'г',
    categorySlug: 'soap-mass',
    isActive: true,
    isFeatured: false,
    tags: ['лепка', 'фигурное мыло', 'без плавления'],
  },

  // ─── Комплексы масел ─────────────────────────────────────────
  {
    sku: 'OIL-001',
    slug: 'kompleks-masel-spa-30ml',
    name: 'Масляный комплекс SPA 30 мл',
    description:
      'Обогащённый масляный комплекс для добавления в мыльную основу и косметику. Состав: масло ши, масло кокоса, масло авокадо, витамин Е. Рекомендуемая концентрация: 1-3% от веса изделия.',
    priceKopecks: 29000,  // 290 RUB
    stockQuantity: 100,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 30,
    unit: 'мл',
    categorySlug: 'oil-complexes',
    isActive: true,
    isFeatured: true,
    tags: ['ши', 'кокос', 'авокадо', 'витамин E'],
  },
  {
    sku: 'OIL-002',
    slug: 'kompleks-masel-detskiy-30ml',
    name: 'Масляный комплекс детский 30 мл',
    description:
      'Мягкий масляный комплекс для детской косметики. Состав: масло миндаля, масло персиковых косточек, масло ромашки. Гипоаллергенный состав. Рекомендуется для мыла и кремов для детей.',
    priceKopecks: 34000,  // 340 RUB
    stockQuantity: 80,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 30,
    unit: 'мл',
    categorySlug: 'oil-complexes',
    isActive: true,
    isFeatured: false,
    tags: ['детское', 'миндаль', 'гипоаллергенный'],
  },

  // ─── Отдушки ─────────────────────────────────────────────────
  {
    sku: 'FRG-001',
    slug: 'otdushka-lavanda-premium-10ml',
    name: 'Отдушка «Лаванда Прованская» 10 мл',
    description:
      'Классическая цветочная отдушка лаванды. Масляная (не спиртовая). Устойчивость аромата в мыле: 6-8 месяцев. Рекомендуемая концентрация: 2-3% от веса изделия.',
    priceKopecks: 18000,  // 180 RUB
    stockQuantity: 300,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 10,
    unit: 'мл',
    categorySlug: 'fragrances',
    isActive: true,
    isFeatured: true,
    tags: ['лаванда', 'цветочный', 'релакс'],
  },
  {
    sku: 'FRG-002',
    slug: 'otdushka-vanilnaya-karamel-10ml',
    name: 'Отдушка «Ванильная карамель» 10 мл',
    description:
      'Тёплый сладкий аромат ванили с нотами карамели. Хорошо сочетается с белой мыльной основой. Отличная стойкость. Рекомендуемая концентрация: 1-2%.',
    priceKopecks: 19000,  // 190 RUB
    stockQuantity: 250,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 10,
    unit: 'мл',
    categorySlug: 'fragrances',
    isActive: true,
    isFeatured: false,
    tags: ['ваниль', 'карамель', 'сладкий'],
  },
  {
    sku: 'FRG-003',
    slug: 'otdushka-morskoy-briz-10ml',
    name: 'Отдушка «Морской бриз» 10 мл',
    description:
      'Свежий морской аромат с нотами водорослей и морской соли. Идеален для гелей для душа и морских коллекций мыла.',
    priceKopecks: 17000,  // 170 RUB
    stockQuantity: 280,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 10,
    unit: 'мл',
    categorySlug: 'fragrances',
    isActive: true,
    isFeatured: false,
    tags: ['морской', 'свежий', 'аква'],
  },

  // ─── Красители ───────────────────────────────────────────────
  {
    sku: 'CLR-001',
    slug: 'slyuda-perlamutrovaya-rozovaya-10g',
    name: 'Слюда перламутровая «Роза» 10 г',
    description:
      'Косметическая слюда с нежным розовым перламутровым оттенком. Применяется в мыловарении, бомбах для ванны, тенях и хайлайтерах. Хорошо диспергируется в масляных и водных фазах.',
    priceKopecks: 22000,  // 220 RUB
    stockQuantity: 200,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 10,
    unit: 'г',
    categorySlug: 'colorants',
    isActive: true,
    isFeatured: true,
    tags: ['слюда', 'перламутр', 'розовый'],
  },

  // ─── Формы ───────────────────────────────────────────────────
  {
    sku: 'MLD-001',
    slug: 'forma-silikonovaya-rozochki-6yacheek',
    name: 'Форма силиконовая «Розочки» 6 ячеек',
    description:
      'Профессиональная силиконовая форма для мыла. 6 ячеек в форме розы, каждая объёмом 80 мл. Жаростойкость до 230°C, морозостойкость до -60°C. Долговечна, не деформируется.',
    priceKopecks: 67000,  // 670 RUB
    stockQuantity: 150,
    minOrderQuantity: 1,
    maxOrderQuantity: 20,
    weightGrams: 350,
    unit: 'шт',
    categorySlug: 'molds',
    isActive: true,
    isFeatured: true,
    tags: ['силикон', '6 ячеек', 'роза', 'жаростойкая'],
  },
  {
    sku: 'MLD-002',
    slug: 'forma-silikonovaya-loaf-1kg',
    name: 'Форма силиконовая «Буханка» 1 кг',
    description:
      'Прямоугольная силиконовая форма-буханка для отливки мыльного блока весом до 1 кг. Размер 230×80×60 мм. Поставляется без деревянного ящика. Стойкая к NaOH.',
    priceKopecks: 89000,  // 890 RUB
    stockQuantity: 100,
    minOrderQuantity: 1,
    maxOrderQuantity: 10,
    weightGrams: 400,
    unit: 'шт',
    categorySlug: 'molds',
    isActive: true,
    isFeatured: false,
    tags: ['силикон', 'буханка', 'loaf', 'холодное варение'],
  },
] as const;

async function main(): Promise<void> {
  console.log('Seeding products...');

  for (const product of PRODUCTS) {
    // Look up the category ID by slug
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: product.categorySlug },
      select: { id: true },
    });

    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        slug: product.slug,
        description: product.description,
        priceKopecks: BigInt(product.priceKopecks),
        stockQuantity: product.stockQuantity,
        minOrderQuantity: product.minOrderQuantity,
        maxOrderQuantity: product.maxOrderQuantity,
        weightGrams: product.weightGrams,
        unit: product.unit,
        categoryId: category.id,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        tags: product.tags as string[],
      },
      create: {
        sku: product.sku,
        slug: product.slug,
        name: product.name,
        description: product.description,
        priceKopecks: BigInt(product.priceKopecks),
        stockQuantity: product.stockQuantity,
        reservedQuantity: 0,
        minOrderQuantity: product.minOrderQuantity,
        maxOrderQuantity: product.maxOrderQuantity,
        weightGrams: product.weightGrams,
        unit: product.unit,
        categoryId: category.id,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        tags: product.tags as string[],
      },
    });

    const priceRub = (product.priceKopecks / 100).toFixed(2);
    console.log(`  ✓ [${product.sku}] ${product.name} — ${priceRub} RUB`);
  }

  console.log(`Done: ${PRODUCTS.length} products seeded.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
