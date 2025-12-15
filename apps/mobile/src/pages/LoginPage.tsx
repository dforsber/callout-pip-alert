import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { signIn, signUp, confirmSignUp, isConfigured } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isConfirming) {
        await confirmSignUp(email, confirmCode);
        setIsConfirming(false);
        setIsSignUp(false);
        setError("Account confirmed! Please sign in.");
      } else if (isSignUp) {
        await signUp(email, password, name);
        setIsConfirming(true);
      } else {
        await signIn(email, password);
        navigate("/incidents");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">CW Alarms</h1>
        <p className="text-gray-500 text-center mb-8">CloudWatch Alarm Management</p>

        {!isConfigured && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm mb-3">
              No cloud backend configured. Please add your backend configuration to get started.
            </p>
            <Link
              to="/settings"
              className="block w-full py-2 bg-amber-600 text-white rounded-lg font-medium text-center"
            >
              Configure Backend
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !isConfirming && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          )}

          {!isConfirming && (
            <>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </>
          )}

          {isConfirming && (
            <input
              type="text"
              placeholder="Confirmation Code"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          )}

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading
              ? "Loading..."
              : isConfirming
              ? "Confirm"
              : isSignUp
              ? "Sign Up"
              : "Sign In"}
          </button>
        </form>

        {!isConfirming && (
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="w-full mt-4 text-blue-600 text-sm"
          >
            {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
          </button>
        )}
      </div>
    </div>
  );
}
