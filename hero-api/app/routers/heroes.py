from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select

from app.database import SessionDep, engine
from app.models import (
    Hero, HeroCreate, HeroPublic, HeroUpdate,
    Team,
)

router = APIRouter( prefix="/heroes", tags=["heroes"] )


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)   # create missing tables
    yield


app = FastAPI(lifespan=lifespan)


def ensure_team_exists(session: Session, team_id: int | None):
    """Part 6.3: an unknown team_id gives 404 instead of a 500 from the FK."""
    if team_id is not None and not session.get(Team, team_id):
        raise HTTPException(status_code=404, detail="Team not found")

    

@router.post("", response_model=HeroPublic, status_code=201)
def create_hero(hero_in: HeroCreate, session: SessionDep):
    ensure_team_exists(session, hero_in.team_id)
    hero = Hero.model_validate(hero_in)
    session.add(hero)
    session.commit()
    session.refresh(hero)
    return hero


@router.get("", response_model=list[HeroPublic])
def list_heroes(
    session: SessionDep,
    offset: int = 0,
    limit: int = Query(default=10, le=100),
    min_age: int | None = None,
    team_id: int | None = None,
    name: str | None = None,
):
    statement = select(Hero)
    if min_age is not None:
        statement = statement.where(Hero.age >= min_age)
    if team_id is not None:
        statement = statement.where(Hero.team_id == team_id)
    if name:
        statement = statement.where(Hero.name.ilike(f"%{name}%"))
    statement = statement.order_by(Hero.id).offset(offset).limit(limit)
    return session.exec(statement).all()


@router.get("/{hero_id}", response_model=HeroPublic)
def read_hero(hero_id: int, session: SessionDep):
    hero = session.get(Hero, hero_id)
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    return hero


@router.patch("/{hero_id}", response_model=HeroPublic)
def update_hero(hero_id: int, hero_in: HeroUpdate, session: SessionDep):
    hero = session.get(Hero, hero_id)
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    data = hero_in.model_dump(exclude_unset=True)
    ensure_team_exists(session, data.get("team_id"))
    hero.sqlmodel_update(data)
    session.add(hero)
    session.commit()
    session.refresh(hero)
    return hero


@router.delete("/{hero_id}", status_code=204)
def delete_hero(hero_id: int, session: SessionDep):
    hero = session.get(Hero, hero_id)
    if not hero:
        raise HTTPException(status_code=404, detail="Hero not found")
    session.delete(hero)
    session.commit()
