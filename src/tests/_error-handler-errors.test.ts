import { ZodError, z } from "zod";
import { errorHandler } from "../errors/_error-handler.ts";
import { BadRequestError } from "../errors/bad-request-error.ts";
import { ForbiddenError } from "../errors/forbidden-error.ts";
import { NotFoundError } from "../errors/not-found-error.ts";
import { SpotifyFetchError } from "../errors/spotify-fetch-error.ts";
import { UnauthorizedError } from "../errors/unauthorized-error.ts";

describe("errorHandler", () => {
  let replyMock: any;

  beforeEach(() => {
    replyMock = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it("deve retornar 400 para ZodError", () => {
    const createZodError = (): ZodError => {
      try {
        z.string().parse(123);
      } catch (err) {
        if (err instanceof ZodError) {
          return err;
        }
        throw err;
      }
      throw new Error("ZodError não lançado");
    };
    const zodErr = createZodError();
    errorHandler(
      zodErr as unknown as Error & { code: string },
      {} as any,
      replyMock
    );

    expect(replyMock.status).toHaveBeenCalledWith(400);
    expect(replyMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation error",
        errors: expect.any(Object),
      })
    );
  });

  it.each([
    [new BadRequestError("bad request"), 400],
    [new UnauthorizedError("unauthorized"), 401],
    [new ForbiddenError("forbidden"), 403],
    [new NotFoundError("not found"), 404],
    [new SpotifyFetchError("spotify fail"), 502],
  ])("deve retornar status correto para %p", (error, status) => {
    const err = error as unknown as Error & { code: string };
    errorHandler(err, {} as any, replyMock);

    expect(replyMock.status).toHaveBeenCalledWith(status);
    expect(replyMock.send).toHaveBeenCalledWith({ message: error.message });
  });

  it("deve retornar 500 para erro desconhecido", () => {
    const err = new Error("unknown") as unknown as Error & { code: string };
    errorHandler(err, {} as any, replyMock);

    expect(replyMock.status).toHaveBeenCalledWith(500);
    expect(replyMock.send).toHaveBeenCalledWith({
      message: "Internal server error.",
    });
  });
});
