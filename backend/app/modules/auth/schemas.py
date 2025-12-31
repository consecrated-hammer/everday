from datetime import datetime

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    AccessToken: str
    RefreshToken: str
    TokenType: str = "bearer"
    ExpiresIn: int
    Username: str
    RequirePasswordChange: bool
    FirstName: str | None = None
    LastName: str | None = None
    Email: str | None = None
    DiscordHandle: str | None = None


class LoginRequest(BaseModel):
    Username: str = Field(..., max_length=120)
    Password: str = Field(..., max_length=200)


class RefreshRequest(BaseModel):
    RefreshToken: str = Field(..., max_length=400)


class UserRoleOut(BaseModel):
    ModuleName: str
    Role: str


class UserOut(BaseModel):
    Id: int
    Username: str
    FirstName: str | None = None
    LastName: str | None = None
    Email: str | None = None
    DiscordHandle: str | None = None
    Roles: list[UserRoleOut]
    CreatedAt: datetime
    RequirePasswordChange: bool


class UpdateUserRoleRequest(BaseModel):
    ModuleName: str = Field(..., max_length=80)
    Role: str = Field(..., max_length=20)


class UpdateUserPasswordRequest(BaseModel):
    NewPassword: str = Field(..., max_length=200)


class ChangePasswordRequest(BaseModel):
    CurrentPassword: str = Field(..., max_length=200)
    NewPassword: str = Field(..., max_length=200)


class UpdateUserProfileRequest(BaseModel):
    FirstName: str | None = Field(default=None, max_length=120)
    LastName: str | None = Field(default=None, max_length=120)
    Email: str | None = Field(default=None, max_length=254)
    DiscordHandle: str | None = Field(default=None, max_length=120)


class ForgotPasswordRequest(BaseModel):
    Identifier: str = Field(..., max_length=254)


class ResetPasswordRequest(BaseModel):
    Token: str = Field(..., max_length=200)
    NewPassword: str = Field(..., max_length=200)
