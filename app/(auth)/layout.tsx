import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Attendant Authentication - Jarvis",
  description: "Attendant enrollment and authentication",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className='w-full relative'>{children}</div>
}
