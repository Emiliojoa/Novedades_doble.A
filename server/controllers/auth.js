import * as auth from "../services/auth.js";
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: auth.SESSION_MS,
});
async function respondSession(res, user, status = 200) {
  res.cookie("session", await auth.createSession(user.id), cookieOptions());
  res.status(status).json(user);
}
export const register = async (req, res) =>
  await respondSession(res, await auth.register(req.data), 201);
export const login = async (req, res) =>
  await respondSession(res, await auth.login(req.data));
export const logout = async (req, res) => {
  await auth.logout(req.cookies.session);
  res.clearCookie("session", cookieOptions());
  res.json({
    ok: true,
  });
};
export const me = (req, res) => res.json(req.user);
