# المطلوب من الباك إند: كومبو لكل صنف داخل القائمة

> **الحالة:** واجهة الداشبورد جاهزة وتنتظر الباك. قبل أن يجهّز الباك هذه الميزة لا يتغير أي شيء في الداشبورد
> (الكومبو يبقى لكل أصناف القائمة كما هو اليوم)، فلا حاجة لتنسيق وقت النشر.

## 1. الطلب باختصار

العميل يريد أن يظهر الكومبو (الوجبة) لأصناف معيّنة فقط، مثل الساندويتشات، لا لكل أصناف القائمة.

اليوم سعر الكومبو واحد للقائمة كلها، ويُطبَّق على أي صنف. المطلوب حقل على **كل صنف داخل القائمة** يحدد هل
يظهر له خيار الوجبة أم لا. سعر الكومبو نفسه يبقى واحداً للقائمة، ولا يتغير.

## 2. الوضع الحالي (لا تغيير عليه)

| الموضوع | الوضع اليوم |
|---|---|
| إعداد الكومبو | `PUT /api/menus/{menu}/combo` بالجسم `combo_price` و`combo_name` و`combo_name_ar`، الصلاحية `menus.combo.update` |
| قراءة القائمة | `GET /api/menus/{id}` و`GET /api/public/menus/{id}` يرجعان `combo_price` و`items[]` |
| صف الصنف في `items[]` | `item_id` (أو `id`) و`price` و`currency` و`is_available` و`suggested_item_ids` و`meal_price` و`category` |
| `meal_price` | للقراءة فقط، يحسبه الخادم: سعر الصنف + `combo_price` |
| طلب الوجبة (الكاشير) | `POST /api/admin/orders` ← `items[].variant` بقيمة `"sandwich"` أو `"meal"` |
| طلب الوجبة (الموقع) | `POST /api/orders/{order}/menu-items`. تحقّقوا أنه يقبل `variant` أيضاً، فالداشبورد لا يرسل له وجبات |
| مفتاح مشابه موجود | `PUT /api/menus/{menu}/items/{item}/availability` بالجسم `{ "is_available": bool }` والرد `{ "data": { "is_available": bool } }`، الصلاحية `menus.items.availability.update` |

الميزة الجديدة تتبع نمط `availability` نفسه.

## 3. المطلوب بالتفصيل

### 3.1 قاعدة البيانات

في جدول العلاقة بين القائمة والصنف (الذي فيه `price` و`currency`):

- عمود جديد `has_combo`، من نوع boolean، `NOT NULL`، القيمة الافتراضية `true`.
- الـ migration تُبقي كل الصفوف الموجودة `true`، فلا يتغير سلوك أي فرع بعد النشر.

### 3.2 القراءة

أضيفوا `has_combo` (boolean دائماً، ليس `null`) إلى كل صنف داخل `items[]` في كل مكان تُرجَع فيه أصناف القائمة:

- `GET /api/menus/{id}` ← يقرؤه الداشبورد (صفحة القائمة ونقطة البيع).
- `GET /api/public/menus/{id}` ← يقرؤه الداشبورد (صفحة القائمة) والموقع.
- أي مكان آخر يُرجع أصناف القائمة للموقع، مثل `/api/public/branches/{id}` إن كانت القائمة فيه.

وفي الأمكنة نفسها:

- `meal_price` يرجع `null` للصنف الذي `has_combo = false`.
- إن كانت القائمة بلا سعر كومبو (`combo_price` فارغ أو 0) تبقى قيمة `has_combo` محفوظة كما هي وبلا أي تأثير.

### 3.3 الحفظ

```
PUT /api/menus/{menu}/items/{item}/combo
Authorization: Bearer <token>
Content-Type: application/json

{ "has_combo": false }
```

- التحقق: `has_combo` مطلوب ومن نوع boolean.
- الرد الناجح `200`:

```json
{ "data": { "has_combo": false } }
```

الداشبورد يعتمد على `data.has_combo` كالحالة المحفوظة. وإن غاب الحقل فيأخذ ما أرسله هو.

- الطلب متكرر الأمان (idempotent): إرسال القيمة نفسها مرتين لا يسبب خطأ.
- لا يشترط وجود `combo_price` للحفظ.
- الأخطاء:

| الحالة | الرد |
|---|---|
| بلا تسجيل دخول | `401` |
| ينقص الصلاحية | `403` |
| مدير فرع على قائمة فرع غيره | `403` بالكود `outside_your_branch` |
| القائمة أو الصنف غير موجود، أو الصنف ليس في هذه القائمة | `404` |
| `has_combo` ناقص أو ليس boolean | `422` مع `errors.has_combo` |

### 3.4 الصلاحيات

- صلاحية جديدة **`menus.items.combo.update`**. تُولَّد من اسم المسار كبقية الصلاحيات، فتظهر في محرر الأدوار تحت
  مجموعة **Menus**. اليوم لا تظهر فيها إلا `menus.items.addons.exclusions.update` و`menus.items.availability.update`
  و`menus.items.suggestions.update`.
- امنحوها في الـ seed أو الـ migration للأدوار التي تملك `menus.combo.update`.
- مدير الفرع يعدّل قائمة فرعه فقط، كما في `availability`.

### 3.5 قواعد الطلب

إضافة صنف بـ `variant = "meal"` وهو `has_combo = false` تُرفض:

```json
HTTP 422
{
  "code": "combo_not_offered",
  "message": "رسالة مترجمة جاهزة",
  "data": { "item_id": 12, "menu_id": 3 }
}
```

- تنطبق على كل مسار يقبل `variant`: `POST /api/admin/orders` (الكاشير) و`POST /api/orders/{order}/menu-items`
  (الموقع)، وأي مسار آخر.
- الكاشير **غير مستثنى** من هذه القاعدة. على عكس قواعد الدوام وإيقاف التوصيل، الكومبو قاعدة منتج لا قاعدة وقت.
- يُعاد الفحص عند `POST /api/orders/{order}/submit`: إن عُطّل الكومبو لصنف بعد أن وضعه الزبون وجبة في سلته،
  يُرفض الطلب بالكود نفسه مع `data.item_id`، كما يُفعل مع `extra_not_offered`.
- التسعير: الصنف `has_combo = true` يُسعَّر كما اليوم. أما الصنف `has_combo = false` فلا يُضاف إليه `combo_price` أبداً.
- الكود **`combo_not_offered`** يُضاف إلى جدول الأكواد. الداشبورد يتعامل مع `code` لا مع نص `message`.

## 4. أمثلة كاملة

### قراءة القائمة

```json
GET /api/menus/3

{
  "id": 3,
  "branch_id": 15,
  "currency": "SYP",
  "combo_price": "3000.00",
  "combo_name": "Fries + drink",
  "combo_name_ar": "بطاطا ومشروب",
  "items": [
    { "item_id": 1, "name": "Classic Burger", "price": "5000.00", "currency": "SYP",
      "is_available": true, "has_combo": true,  "meal_price": "8000.00" },
    { "item_id": 2, "name": "Cola",           "price": "1500.00", "currency": "SYP",
      "is_available": true, "has_combo": false, "meal_price": null }
  ]
}
```

### استثناء صنف من الكومبو

```
PUT /api/menus/3/items/2/combo
{ "has_combo": false }

← 200 { "data": { "has_combo": false } }
```

### طلب وجبة لصنف مستثنى

```
POST /api/admin/orders
{ "branch_id": 15, "items": [ { "item_id": 2, "quantity": 1, "variant": "meal" } ], "payment_method": "cash" }

← 422 { "code": "combo_not_offered", "message": "...", "data": { "item_id": 2, "menu_id": 3 } }
```

## 5. اختبارات القبول (للباك)

| # | السيناريو | المتوقع |
|---|---|---|
| 1 | بعد الـ migration، قراءة أي قائمة | كل الأصناف `has_combo: true` وسعر الوجبة كما قبل |
| 2 | `PUT .../combo` بـ `false` ثم `GET` القائمة | الصنف `has_combo: false` و`meal_price: null` |
| 3 | `PUT .../combo` بـ `true` | يرجع الصنف لقيمته ويعود `meal_price` |
| 4 | `PUT` بلا `has_combo` أو بقيمة نصية | `422` مع `errors.has_combo` |
| 5 | `PUT` بحساب بلا `menus.items.combo.update` | `403` |
| 6 | مدير فرع A يعدّل قائمة فرع B | `403` بالكود `outside_your_branch` |
| 7 | `PUT` لصنف ليس في هذه القائمة | `404` |
| 8 | طلب وجبة (كاشير) لصنف `has_combo = false` | `422 combo_not_offered` |
| 9 | الطلب نفسه من الموقع | `422 combo_not_offered` |
| 10 | سلة فيها وجبة، ثم عُطّل الكومبو لصنفها، ثم `submit` | `422 combo_not_offered` مع `data.item_id` |
| 11 | طلب `sandwich` لصنف `has_combo = false` | يُقبل بسعر الصنف وحده |
| 12 | صنف `has_combo = true` | تسعيره بلا أي تغيير |
| 13 | قائمة بلا `combo_price`، `PUT` بـ `false` | يُحفظ دون خطأ |
| 14 | ظهور الصلاحية في قائمة الصلاحيات | `menus.items.combo.update` تحت Menus |

## 6. ما فعلته واجهة الداشبورد (للمعلومة)

- **صفحة القائمة:** تحت كل صنف سطر «الكومبو» مع مفتاح. يظهر فقط إذا كان للقائمة `combo_price` أكبر من صفر
  **وأرسل الخادم** `has_combo` لذلك الصنف. فقبل جاهزية الباك لا يظهر شيء.
- **من يملك الصلاحية** `menus.items.combo.update` (ومدير الفرع على قائمة فرعه فقط) يحرّك المفتاح. غيرهم يرى
  «مفعّل/معطّل» نصاً.
- **الحفظ:** `PUT menus/{menu}/items/{item}/combo` بالجسم `{ "has_combo": bool }`، ثم يقرأ `data.has_combo`.
- **نقطة البيع:** خيار «وجبة» يُعطَّل للصنف الذي `has_combo` له `false` صراحةً. غياب الحقل يعني السلوك القديم،
  أي الكومبو متاح.
- **الأخطاء:** يعالج الرمز `combo_not_offered` بنص مترجم للكاشير.
- **الاختبارات:** قراءة الحقل ومنطق الإخفاء مغطّاة باختبارات في `scripts/tests/item-combo.test.mts`.

ترتيب النشر: **الباك أولاً**، ثم يعمل الداشبورد تلقائياً. ويحتاج الموقع إلى إخفاء خيار الوجبة للصنف الذي
`has_combo = false` من جهته (هذا خارج الداشبورد).

## 7. اختياري لاحقاً

سعر كومبو خاص بالصنف: عمود `combo_price` من نوع nullable على العلاقة نفسها، و`null` يعني سعر القائمة.
غير مطلوب الآن.

 