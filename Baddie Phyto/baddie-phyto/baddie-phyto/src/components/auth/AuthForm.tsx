"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const result = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`
          }
        });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (isLogin) {
      window.location.href = "/home";
      return;
    }

    if (result.data.session) {
      window.location.href = "/home";
      return;
    }

    setMessage("確認メールを送信しました。メール内のリンクから認証してください。");
  }

  return (
    <form className="dm-auth-form" onSubmit={handleSubmit}>
      <label>
        メールアドレス
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label>
        パスワード
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
        />
      </label>

      <button className="dm-button primary" type="submit" disabled={loading}>
        {loading ? "処理中..." : isLogin ? "ログイン" : "アカウント作成"}
      </button>

      {message && <p className="dm-form-message">{message}</p>}
    </form>
  );
}
