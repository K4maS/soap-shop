import { RefreshCcw } from 'lucide-react';

export default function ReturnsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-red-50 rounded-2xl text-red-600">
          <RefreshCcw className="h-6 w-6" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-warm-900">Возврат и обмен</h1>
      </div>

      <div className="prose prose-sage max-w-none text-warm-700 space-y-6">
        <p>
          Мы стремимся к тому, чтобы вы остались довольны покупкой в «Mylo Master».
          Если же товар вам не подошел, ознакомьтесь с правилами возврата.
        </p>

        <section>
          <h2 className="text-xl font-bold text-warm-900 mb-4">1. Возврат товара надлежащего качества</h2>
          <p>
            В соответствии с Постановлением Правительства РФ от 31.12.2020 № 2463, парфюмерно-косметические товары
            надлежащего качества не подлежат возврату или обмену на аналогичный товар других размера, формы, габарита, фасона, расцветки или комплектации.
          </p>
          <p>
            Однако, если вы приобрели у нас сопутствующие аксессуары (например, мыльницы или упаковку), вы имеете право
            вернуть их в течение 14 дней, если товар не был в употреблении, сохранены его товарный вид, потребительские свойства, пломбы и фабричные ярлыки.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-warm-900 mb-4">2. Возврат товара ненадлежащего качества</h2>
          <p>
            Если вы обнаружили брак или несоответствие товара заказанному, пожалуйста, свяжитесь с нами в течение
            3 дней с момента получения заказа. Мы произведем замену товара или вернем деньги.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-warm-900 mb-4">3. Процедура возврата</h2>
          <p>
            Для оформления возврата напишите нам на почту <span className="font-medium text-sage-600">returns@mylomaster.ru</span>
            с указанием номера заказа и приложением фото товара. Мы свяжемся с вами в течение 24 часов.
          </p>
        </section>

        <p className="text-sm text-warm-500 pt-8 border-t border-warm-100">
          Последнее обновление: {new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>
    </div>
  );
}
