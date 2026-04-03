import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { Factory, Loader2 } from "lucide-react";

const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errorMessage);
      } else {
        setError("Login failed. Is the backend server running?");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Factory className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">SMOP</h1>
          <p className="text-muted-foreground text-sm mt-1">Speedage Manufacturing Operations Platform</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-lg p-8">
          <h2 className="text-lg font-semibold text-foreground mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                placeholder="Enter username"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={loading}
                required
              />
            </div>
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Default credentials: <span className="font-medium">admin</span> / <span className="font-medium">password123</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
