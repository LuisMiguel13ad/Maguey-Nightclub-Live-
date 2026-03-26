import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Unauthorized() {
    const navigate = useNavigate();

    return (
        <div data-cy="unauthorized-page" className="min-h-screen bg-gradient-dark flex flex-col items-center justify-center p-4 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-gray-400 max-w-md mb-8">
                You don't have permission to access this page. Please contact an administrator if you believe this is an error.
            </p>

            <div className="flex gap-4">
                <Button
                    variant="outline"
                    data-cy="unauthorized-back-button"
                    onClick={() => navigate(-1)}
                    className="border-white/10 text-white hover:bg-white/5"
                >
                    Go Back
                </Button>
                <Button
                    onClick={() => navigate("/")}
                    className="bg-primary text-black hover:bg-primary/90"
                >
                    Return Home
                </Button>
            </div>
        </div>
    );
}
