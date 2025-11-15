import { User, LogOut, Settings, Mail } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/context/AuthContext"

export function UserSidebar({ open, onOpenChange }) {
  const { logout, user } = useAuth()

  const handleLogout = () => {
    logout()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle>User Profile</SheetTitle>
          <SheetDescription>
            Manage your account settings and preferences
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* User Info Section */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{user?.username || "User"}</h3>
              {user?.email && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Mail className="h-3 w-3" />
                  <span>{user.email}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Menu Options */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                // Future: Navigate to settings page
                console.log("Settings clicked")
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>

            <Separator />

            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>

          <Separator />

          {/* Additional Info */}
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold mb-2">About Conote</p>
            <p>A collaborative note-taking application for teams.</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
