import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from '@web/components/ui/input';
import { Select } from '@web/components/ui/select';
import { Switch } from '@web/components/ui/switch';

/**
 * The three form controls together, because their resting, focused, error and
 * disabled states have to agree with each other — a rule that is easy to break
 * one component at a time.
 */
const meta = {
  title: 'Components/Form controls',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const METHODS = [
  { value: 'cash', label: 'نقداً' },
  { value: 'card', label: 'بطاقة' },
  { value: 'transfer', label: 'حوالة' },
];

export const States: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">نص</span>
        <Input defaultValue="أحمد خالد الحسن" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">نص فارغ</span>
        <Input placeholder="الاسم الكامل" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">خطأ</span>
        <Input defaultValue="غير صحيح" hasError />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">معطّل</span>
        <Input defaultValue="لا يمكن التعديل" disabled />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">قائمة</span>
        <Select options={METHODS} defaultValue="cash" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">قائمة بقيمة مبدئية</span>
        <Select options={METHODS} placeholder="اختر طريقة الدفع" defaultValue="" />
      </label>

      <div className="flex items-center gap-3">
        <Switch checked label="مفعّل" onCheckedChange={() => undefined} />
        <span className="text-sm text-ink">مفعّل</span>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={false} label="متوقف" onCheckedChange={() => undefined} />
        <span className="text-sm text-ink">متوقف</span>
      </div>
    </div>
  ),
};

/**
 * A number in an Arabic form keeps its own direction: without the `dir="ltr"`
 * island a leading minus or plus floats to the wrong end of the value.
 */
export const LatinValuesInArabicForm: Story = {
  name: 'Latin values in an Arabic form',
  render: () => (
    <div className="grid max-w-3xl gap-6 md:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">رقم الهاتف</span>
        <Input dir="ltr" defaultValue="+963931000001" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink">المبلغ</span>
        <Input dir="ltr" inputMode="decimal" defaultValue="1435.00" />
      </label>
    </div>
  ),
};
