'use client';

import React, { useState } from 'react';
import { Building2, X, Loader2, Plus, Sparkles, Globe, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminApiClient } from '@/lib/admin-api';
import { Application } from '@/types/admin';

interface AddMerchantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (merchant: Application, generatedKey: string, generatedWebhookSecret?: string) => void;
}

export function AddMerchantModal({
  isOpen,
  onClose,
  onSuccess,
}: AddMerchantModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(autoSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Application name is required.');
      return;
    }

    if (!slug.trim()) {
      setErrorMessage('Application slug is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminApiClient.merchants.create({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        webhookUrl: webhookUrl.trim() || undefined,
      });

      onSuccess(res.application, res.apiKey, res.webhookSecret);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register merchant application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-left space-y-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Building2 className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">
                Register New Application Merchant
              </h3>
              <p className="text-xs text-slate-500">
                Creates an isolated tenant account with live API credentials
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 focus:outline-hidden"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Business / App Name</Label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Serengeti Tours"
                className="h-9 text-xs bg-slate-50/50 border-slate-200"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Unique Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="serengeti-tours"
                className="h-9 text-xs font-mono bg-slate-50/50 border-slate-200"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700">Business Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Commercial description and settlement purpose..."
              className="h-9 text-xs bg-slate-50/50 border-slate-200"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Globe className="size-3.5 text-slate-400" />
              <Label className="text-xs font-semibold text-slate-700">Webhook Notification URL</Label>
            </div>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.merchant.com/v1/reignova-callback"
              className="h-9 text-xs font-mono bg-slate-50/50 border-slate-200"
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs text-emerald-900 flex items-center gap-2.5">
            <Shield className="size-4 text-emerald-600 shrink-0" />
            <span className="leading-tight">
              Webhook signing secret (<code>whsec_...</code>) will be <strong>auto-generated</strong> and displayed for copying upon registration.
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 gap-1.5 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Provisioning Merchant...</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  <span>Register & Generate Keys</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
