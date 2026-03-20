'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export default function SettingsPage() {
  return (
    <DashboardLayout title="Settings" subtitle="Configure your arbitrage dashboard">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
            <CardDescription>Configure minimum spread thresholds for each strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Spot-Futures Min Basis (%)</FieldLabel>
                <Input type="number" defaultValue="0.15" step="0.01" />
              </Field>
              <Field>
                <FieldLabel>Funding Rate Min Annualized (%)</FieldLabel>
                <Input type="number" defaultValue="15" step="1" />
              </Field>
              <Field>
                <FieldLabel>Calendar Spread Min (%)</FieldLabel>
                <Input type="number" defaultValue="0.50" step="0.05" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Exchange Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Exchange Connections</CardTitle>
            <CardDescription>Enable or disable exchanges for monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field className="flex items-center justify-between">
                <FieldLabel>Binance</FieldLabel>
                <Switch defaultChecked />
              </Field>
              <Field className="flex items-center justify-between">
                <FieldLabel>Bybit</FieldLabel>
                <Switch defaultChecked />
              </Field>
              <Field className="flex items-center justify-between">
                <FieldLabel>OKX</FieldLabel>
                <Switch defaultChecked />
              </Field>
              <Field className="flex items-center justify-between">
                <FieldLabel>Deribit</FieldLabel>
                <Switch defaultChecked />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Fee Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Configuration</CardTitle>
            <CardDescription>Set your trading fees for accurate PnL calculations</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Maker Fee (%)</FieldLabel>
                <Input type="number" defaultValue="0.02" step="0.001" />
              </Field>
              <Field>
                <FieldLabel>Taker Fee (%)</FieldLabel>
                <Input type="number" defaultValue="0.05" step="0.001" />
              </Field>
              <Field>
                <FieldLabel>Withdrawal Fee ($)</FieldLabel>
                <Input type="number" defaultValue="0.00" step="0.01" />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Configure alert notifications (coming soon)</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field className="flex items-center justify-between">
                <FieldLabel>Browser Notifications</FieldLabel>
                <Switch disabled />
              </Field>
              <Field className="flex items-center justify-between">
                <FieldLabel>Sound Alerts</FieldLabel>
                <Switch disabled />
              </Field>
              <Field className="flex items-center justify-between">
                <FieldLabel>Telegram Alerts</FieldLabel>
                <Switch disabled />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="lg:col-span-2 flex justify-end">
          <Button size="lg">Save Settings</Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
