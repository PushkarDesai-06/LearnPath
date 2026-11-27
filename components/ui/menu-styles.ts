export const menuSurface =
  "menu-pop z-50 max-h-(--radix-popper-available-height) min-w-[11rem] overflow-x-hidden overflow-y-auto rounded-[10px] bg-popover p-1 text-popover-foreground shadow-(--shadow-pop)"

export const menuItem =
  "group/menu-item relative flex h-[30px] cursor-default items-center gap-[9px] rounded-md px-2 text-[13px] text-fg-2 outline-hidden select-none transition-colors duration-(--dur-fast) data-highlighted:bg-active data-highlighted:text-foreground data-[state=open]:bg-active data-[state=open]:text-foreground data-inset:pl-8 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 [&_svg:not([class*='text-'])]:text-muted-foreground data-highlighted:[&_svg:not([class*='text-'])]:text-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive data-[variant=destructive]:[&_svg]:text-destructive!"

export const menuCheckItem = `${menuItem} pr-8 pl-2`

export const menuLabel =
  "px-2 pt-1.5 pb-1 text-[11.5px] font-medium text-faint data-inset:pl-8"

export const menuSeparator = "-mx-1 my-1 h-px bg-border"

export const menuShortcut =
  "ml-auto font-mono text-[10.5px] tracking-normal text-faint group-data-highlighted/menu-item:text-muted-foreground"
