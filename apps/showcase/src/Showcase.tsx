/**
 * The Feather Design System sheet: every foundation component in its main variants and states,
 * rendered in the current brand theme. Used to review a theme before any page is built.
 */
import { Bell, Check, ChevronRight, Sparkles } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@aleeforoughi/feather-react"
import { Alert, AlertDescription, AlertTitle } from "@aleeforoughi/feather-react"
import { Avatar, AvatarFallback } from "@aleeforoughi/feather-react"
import { Badge } from "@aleeforoughi/feather-react"
import { Button } from "@aleeforoughi/feather-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@aleeforoughi/feather-react"
import { Checkbox } from "@aleeforoughi/feather-react"
import { Field, FieldDescription, FieldLabel } from "@aleeforoughi/feather-react"
import { Input } from "@aleeforoughi/feather-react"
import { Label } from "@aleeforoughi/feather-react"
import { Progress } from "@aleeforoughi/feather-react"
import { RadioGroup, RadioGroupItem } from "@aleeforoughi/feather-react"
import { Separator } from "@aleeforoughi/feather-react"
import { Skeleton } from "@aleeforoughi/feather-react"
import { Switch } from "@aleeforoughi/feather-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aleeforoughi/feather-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aleeforoughi/feather-react"
import { Textarea } from "@aleeforoughi/feather-react"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function Showcase() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-6 md:p-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Feather Design System</h1>
        <p className="text-muted-foreground">Every Feather component in this product's theme.</p>
      </header>

      <Section title="Typography">
        <div className="flex flex-col gap-1">
          <p className="font-heading text-5xl font-bold tracking-tight">Display heading</p>
          <p className="font-heading text-2xl font-semibold">Section heading</p>
          <p className="max-w-prose">Body text sits on the background with comfortable line length and the brand's body face.</p>
          <p className="text-sm text-muted-foreground">Muted supporting text for captions and hints.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Sparkles /> Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">
            Large <ChevronRight />
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges and avatars">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>New</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Error</Badge>
          <Avatar>
            <AvatarFallback>QE</AvatarFallback>
          </Avatar>
        </div>
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Card">
          <Card>
            <CardHeader>
              <CardTitle>Weekly report</CardTitle>
              <CardDescription>Cards hold related content and one clear action.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Progress value={64} />
              <p className="text-sm text-muted-foreground">64% complete</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button>
                <Sparkles /> Continue
              </Button>
              <Button variant="ghost">Later</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Form controls">
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" placeholder="you@example.com" />
              <FieldDescription>We only use it to send updates.</FieldDescription>
            </Field>
            <Textarea placeholder="Tell us what you need" />
            <div className="flex items-center gap-2">
              <Checkbox id="terms" defaultChecked />
              <Label htmlFor="terms">I agree to the terms</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="notify" defaultChecked />
              <Label htmlFor="notify">Notify me when it is ready</Label>
            </div>
            <RadioGroup defaultValue="medium" className="flex gap-4">
              {["daily", "weekly", "monthly"].map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} id={`r-${v}`} />
                  <Label htmlFor={`r-${v}`}>{v}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </Section>
      </div>

      <Section title="Tabs">
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger value="one">Overview</TabsTrigger>
            <TabsTrigger value="two">Activity</TabsTrigger>
            <TabsTrigger value="three">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="pt-3 text-sm text-muted-foreground">Tab content follows the active tab.</TabsContent>
        </Tabs>
      </Section>

      <Section title="Feedback">
        <Alert>
          <Bell />
          <AlertTitle>Your report is ready</AlertTitle>
          <AlertDescription>Three new sections were added.</AlertDescription>
        </Alert>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </Section>

      <Section title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[["Invoice", "Finance"], ["Roadmap", "Product"], ["Brief", "Design"]].map(([shot, framing]) => (
              <TableRow key={shot}>
                <TableCell>{shot}</TableCell>
                <TableCell>{framing}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">
                    <Check /> Ready
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Accordion">
        <Accordion>
          <AccordionItem value="a">
            <AccordionTrigger>How long does setup take?</AccordionTrigger>
            <AccordionContent>About five minutes.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Can I change my plan later?</AccordionTrigger>
            <AccordionContent>Yes, at any time.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>
      <Separator />
    </main>
  )
}
