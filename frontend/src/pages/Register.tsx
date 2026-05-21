import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email"),
  workspaceName: z.string().trim().min(1, "Workspace or Brand name is required").max(100),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function Register() {
  const { register: registerUser, login, token, isLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // If already authenticated, bounce to dashboard.
  useEffect(() => {
    if (!isLoading && token) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, token, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormData) => {
    setServerError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');

      login(data.token, data.user, data.workspace);
      navigate("/onboarding");
    } catch (e: any) {
      setServerError(e.message || "Registration failed");
    }
  };

  return (
    <div className={`${theme} flex min-h-screen flex-col bg-background bg-paper-grain`}>
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h1 className="text-2xl font-serif-display font-semibold tracking-tight text-foreground">Create account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Start tracking social media stats in minutes.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <div>
                <Input 
                  placeholder="Full Name" 
                  {...register("name")} 
                  className="bg-background/50 border-border focus-visible:ring-primary rounded-xl"
                />
                {errors.name && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Input 
                  type="email" 
                  placeholder="Email" 
                  {...register("email")} 
                  className="bg-background/50 border-border focus-visible:ring-primary rounded-xl"
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Input 
                  placeholder="Brand / Workspace Name" 
                  {...register("workspaceName")} 
                  className="bg-background/50 border-border focus-visible:ring-primary rounded-xl"
                />
                {errors.workspaceName && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.workspaceName.message}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    {...register("password")}
                    className="bg-background/50 border-border focus-visible:ring-primary rounded-xl pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1.5 text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>



              {serverError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {serverError}
                </div>
              )}

              <Button type="submit" className="w-full rounded-xl" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <div className="my-6 h-px bg-border/60" />

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-foreground hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
