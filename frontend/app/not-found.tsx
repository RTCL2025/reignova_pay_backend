import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <Card className="w-full max-w-md reignova-card border-border/60 shadow-2xl">
        <CardHeader className="flex flex-col items-center gap-4 text-center">
          <div className="size-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertCircle className="size-7" />
          </div>

          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-xl font-bold text-white tracking-tight">
              Checkout Link Not Found
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground leading-relaxed">
              This payment session could not be found or has expired. Please return to the merchant site to start a new checkout.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <Button
            asChild
            variant="outline"
            className="w-full h-11 text-sm font-medium rounded-xl bg-secondary/50 hover:bg-secondary border-border/80 text-white"
          >
            <a href="https://reignovatechnologies.com">
              <ArrowLeft data-icon="inline-start" />
              <span>Go to Reignova Technologies</span>
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
