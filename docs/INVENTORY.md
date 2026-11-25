# Feather 1.7.0: inventory

35 components (28 atoms, 7 molecules), 133 stories. Token schema `feather-tokens/2` (reads `qooe-tokens/1`).

Theme axes: shape (sharp, soft, rounded, pill); density (compact, comfortable, spacious); elevation (flat, soft, dramatic); motion (calm, snappy).

Fonts: DM Sans, Figtree, Fraunces, Geist, Inter, JetBrains Mono, Manrope, Nunito, Outfit, Playfair Display, Plus Jakarta Sans, Poppins, Sora, Space Grotesk.

| Component | Level | Exports | Slots | Stories |
|---|---|---|---|---|
| `accordion` | atom | Accordion, AccordionContent, AccordionItem, AccordionTrigger | 5 | 3 |
| `alert` | atom | Alert, AlertAction, AlertDescription, AlertTitle | 4 | 3 |
| `avatar` | atom | Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage | 6 | 5 |
| `badge` | atom | Badge, badgeVariants | 0 | 7 |
| `breadcrumb` | atom | Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator | 6 | 2 |
| `button` | atom | Button, buttonVariants | 1 | 11 |
| `card` | atom | Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle | 7 | 3 |
| `checkbox` | atom | Checkbox | 2 | 5 |
| `dialog` | atom | Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger | 10 | 3 |
| `dropdown-menu` | atom | DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger | 17 | 4 |
| `field` | atom | Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldTitle | 10 | 4 |
| `input` | atom | Input | 1 | 6 |
| `label` | atom | Label | 1 | 2 |
| `navigation-menu` | atom | NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuPositioner, NavigationMenuTrigger, navigationMenuTriggerStyle | 7 | 2 |
| `popover` | atom | Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger | 6 | 3 |
| `progress` | atom | Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue | 5 | 5 |
| `radio-group` | atom | RadioGroup, RadioGroupItem | 3 | 3 |
| `scroll-area` | atom | ScrollArea, ScrollBar | 4 | 2 |
| `select` | atom | Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue | 9 | 5 |
| `separator` | atom | Separator | 1 | 2 |
| `sheet` | atom | Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger | 10 | 5 |
| `skeleton` | atom | Skeleton | 1 | 3 |
| `sonner` | atom | Toaster | 0 | 4 |
| `switch` | atom | Switch | 2 | 5 |
| `table` | atom | Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow | 9 | 3 |
| `tabs` | atom | Tabs, TabsContent, TabsList, tabsListVariants, TabsTrigger | 4 | 4 |
| `textarea` | atom | Textarea | 1 | 4 |
| `tooltip` | atom | Tooltip, TooltipContent, TooltipProvider, TooltipTrigger | 4 | 4 |
| `activity-feed` | molecule | ActivityFeed, ActivityItem, LiveDot, TypedText, WorkingDots | 7 | 3 |
| `attention-card` | molecule | AttentionCard | 4 | 2 |
| `budget-bar` | molecule | BudgetBar, budgetGeometry, budgetZone, DEFAULT_TARGET_SHARE | 7 | 7 |
| `lightbox` | molecule | Lightbox, lightboxChecker | 4 | 2 |
| `media-gallery` | molecule | MediaGallery, MediaTile | 4 | 2 |
| `role-avatar` | molecule | overflow, RoleAvatar, RoleAvatarGroup, RoleCard, RoleChip, roleInitials | 5 | 4 |
| `step-list` | molecule | StepItem, StepList | 4 | 1 |

Slot names per component are in `packages/react/foundation.json`.

## The website layer in 1.23.0 (wave 5)

The table above is the product UI as of 1.7.0 (`packages/react/foundation.json` is current). Wave 5 added to the
website layer; [patterns.md](patterns.md) maps each piece to its catalog id, and [page.md](page.md) has the fields.

| Piece | Package | What |
|---|---|---|
| Page blocks: media | `feather-page` | `gallery` (rail, masonry, grid, hover-list, wheel), `comparison` (slider), `story` (pinned, stacked), `testimonials` (grid, rail), `journal` (list, featured), `form` (underline, conversational), `showreel` (player) |
| Page blocks: product flows | `feather-page` | `quiz` (steps), `booking` (steps), `calculator` (split, stacked), `chart` (bar, line, area), `places` (list, map), `podcast` (list) |
| New variants | `feather-page` | `work`: fullscreen-cases, bento; `offer`: toggle |
| Knobs | `feather-page` | Block `treatment` (clean, clip-reveal, inner-parallax, blur-to-sharp, duotone, grain), `views` on work; page `scheme` (the colour scheme toggle) and `layout` (editorial, swiss, brutalist, poster, colour-blocking, two-colour); media `srcset` |
| Templates | `feather-page` | `templates/`: launch, studio, editorial, service, product, creator; `feather-page init` |
| Build | `feather-page` | `bin/build.mjs` (the build the CLI and the render gate share); `checkLayout`, `layoutPlan` |
| Image treatments and the placeholder | `feather-expression` | `MediaFrame treatment` and its theme placeholder until the media decodes; `Reel` loops |
| Lightbox | `feather-react` | `Lightbox` can turn off download and name its steps; arrow keys wherever focus is in it |
| Gates | repository | `scripts/render-gate.mjs` (the 2-CPU render budget); the showcase's `?page=media`, `?page=flows` and `?template=<name>` site e2e and Lighthouse runs |
