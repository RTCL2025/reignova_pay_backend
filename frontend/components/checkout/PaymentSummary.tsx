'use client';

import React from 'react';
import { Zap, Smartphone, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface PaymentSummaryProps {
  amount: number;
  currency: string;
  reference: string;
  merchantName: string;
}

export function PaymentSummary({
  amount,
  currency,
  reference,
  merchantName,
}: PaymentSummaryProps) {
  return (
    <Card className="reignova-card border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Order Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Breakdown List */}
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Payment to</span>
            <span className="font-medium text-white">{merchantName}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Reference</span>
            <span className="font-mono text-xs text-primary font-semibold">{reference}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Processing Fee</span>
            <span className="text-emerald-400 font-medium">Free (0.00)</span>
          </div>

          <Separator className="my-1 bg-border/60" />

          <div className="flex justify-between items-baseline pt-1">
            <span className="font-semibold text-white">Total Amount</span>
            <span className="text-xl font-bold text-white font-mono">
              {formatCurrency(amount, currency)}
            </span>
          </div>
        </div>

        <Separator className="bg-border/40" />

        {/* Trust & Guarantee Badges */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
              <Lock className="size-3.5" />
            </div>
            <span>256-bit bank-grade encryption</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
              <Smartphone className="size-3.5" />
            </div>
            <span>Direct mobile USSD prompt to your handset</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <div className="p-1 rounded-md bg-primary/10 text-primary shrink-0">
              <Zap className="size-3.5" />
            </div>
            <span>Real-time instant transaction confirmation</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
