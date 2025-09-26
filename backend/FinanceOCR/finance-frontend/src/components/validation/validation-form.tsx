import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Plus, Trash2, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const invoiceSchema = z.object({
  vendor: z.string().min(1, 'Vendor is required'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  date: z.string().min(1, 'Date is required'),
  line_items: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unit_price: z.number().min(0, 'Unit price must be positive'),
    total: z.number().min(0, 'Total must be positive'),
  })).min(1, 'At least one line item is required'),
  subtotal: z.number().min(0, 'Subtotal must be positive'),
  tax: z.number().min(0, 'Tax must be positive'),
  total: z.number().min(0, 'Total must be positive'),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface ValidationFormProps {
  extractedData?: InvoiceFormData;
}

export function ValidationForm({ extractedData }: ValidationFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: extractedData || {
      vendor: '',
      invoice_number: '',
      date: '',
      line_items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
      subtotal: 0,
      tax: 0,
      total: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'line_items',
  });

  const lineItems = watch('line_items');
  const subtotal = watch('subtotal');
  const tax = watch('tax');

  // Auto-calculate totals
  useEffect(() => {
    const calculatedSubtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    setValue('subtotal', calculatedSubtotal);
    setValue('total', calculatedSubtotal + tax);
  }, [lineItems, tax, setValue]);

  const updateLineItemTotal = (index: number, quantity: number, unitPrice: number) => {
    const total = quantity * unitPrice;
    setValue(`line_items.${index}.total`, total);
  };

  const addLineItem = () => {
    append({ description: '', quantity: 1, unit_price: 0, total: 0 });
  };

  const removeLineItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const onSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true);
    try {
      // Simulate submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Final invoice data:', data);

      toast({
        title: 'Success!',
        description: 'Invoice has been approved and stored successfully.',
      });

      router.push('/dashboard');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to approve invoice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportCSV = () => {
    const data = watch();
    const csvContent = [
      ['Field', 'Value'],
      ['Vendor', data.vendor],
      ['Invoice Number', data.invoice_number],
      ['Date', data.date],
      ['Subtotal', data.subtotal.toString()],
      ['Tax', data.tax.toString()],
      ['Total', data.total.toString()],
      [''],
      ['Line Items'],
      ['Description', 'Quantity', 'Unit Price', 'Total'],
      ...data.line_items.map(item => [
        item.description,
        item.quantity.toString(),
        item.unit_price.toString(),
        item.total.toString(),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice-${data.invoice_number || 'data'}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Information</CardTitle>
          <CardDescription>
            Basic invoice details extracted from the document
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="vendor">Vendor</Label>
            <Input
              id="vendor"
              {...register('vendor')}
              className={errors.vendor ? 'border-red-500' : ''}
            />
            {errors.vendor && (
              <p className="text-sm text-red-500 mt-1">{errors.vendor.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="invoice_number">Invoice Number</Label>
            <Input
              id="invoice_number"
              {...register('invoice_number')}
              className={errors.invoice_number ? 'border-red-500' : ''}
            />
            {errors.invoice_number && (
              <p className="text-sm text-red-500 mt-1">{errors.invoice_number.message}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              {...register('date')}
              className={errors.date ? 'border-red-500' : ''}
            />
            {errors.date && (
              <p className="text-sm text-red-500 mt-1">{errors.date.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>
                Items and services listed on the invoice
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-24">Quantity</TableHead>
                <TableHead className="w-32">Unit Price</TableHead>
                <TableHead className="w-32">Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Input
                      {...register(`line_items.${index}.description`)}
                      placeholder="Item description"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      {...register(`line_items.${index}.quantity`, {
                        valueAsNumber: true,
                        onChange: (e) => {
                          const quantity = parseFloat(e.target.value) || 0;
                          const unitPrice = lineItems[index]?.unit_price || 0;
                          updateLineItemTotal(index, quantity, unitPrice);
                        }
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`line_items.${index}.unit_price`, {
                        valueAsNumber: true,
                        onChange: (e) => {
                          const unitPrice = parseFloat(e.target.value) || 0;
                          const quantity = lineItems[index]?.quantity || 0;
                          updateLineItemTotal(index, quantity, unitPrice);
                        }
                      })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`line_items.${index}.total`, { valueAsNumber: true })}
                      readOnly
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                  </TableCell>
                  <TableCell>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Subtotal:
                </TableCell>
                <TableCell className="font-medium">
                  ${subtotal.toLocaleString()}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Tax:
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('tax', { valueAsNumber: true })}
                    className="w-full"
                  />
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold">
                  Total:
                </TableCell>
                <TableCell className="font-bold">
                  ${(subtotal + tax).toLocaleString()}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={exportCSV}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Approving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Approve Data
            </>
          )}
        </Button>
      </div>
    </form>
  );
}