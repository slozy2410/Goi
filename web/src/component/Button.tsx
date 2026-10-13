import type { ReactNode } from "react";

interface ButtonProps {
    color?: string;
    className?: string;
    onClick?: () => void;
    children?: ReactNode;
}
export default function Button({
    className = "",
    onClick,
    children = "Click"
}: ButtonProps) {
    return (
        <button onClick={onClick} className={`text-white font-bold border border-red-600 rounded-md hover:bg-red-400 hover:cursor-pointer bg-red-500 px-4 py-1 ${className}`}>
            {children}
        </button>
    )
}