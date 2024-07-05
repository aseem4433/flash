import { NextResponse } from "next/server";
import { UpdateCreatorParams } from "@/types";
import { updateUser } from "@/lib/actions/creator.actions";

export async function PUT(request: Request) {
	try {
		const { userId, user }: { userId: string; user: UpdateCreatorParams } =
			await request.json();
		const updatedUser = await updateUser(userId, user);
		return NextResponse.json(updatedUser);
	} catch (error) {
		console.error(error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
