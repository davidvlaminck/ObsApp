from fastapi import APIRouter, Depends, HTTPException, status

from app.api.auth import get_current_user
from app.core.database import get_db
from app.repositories.observation_repository import ObservationRepository
from app.repositories.school_repository import SchoolRepository
from app.schemas.observation import ObservationCreate, ObservationResponse, ObservationUpdate
from app.schemas.user import UserResponse

router = APIRouter(prefix="/observations", tags=["observations"])


@router.post("", response_model=ObservationResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ObservationResponse, status_code=status.HTTP_201_CREATED)
def create_observation(
    payload: ObservationCreate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if current_user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen geldige school gekoppeld",
        )

    if not SchoolRepository(db).get_by_id(current_user.school_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="School niet gevonden")

    observation_repo = ObservationRepository(db)
    return observation_repo.to_response(
        observation_repo.create(payload, current_user.school_id, current_user.id)
    )


@router.get("", response_model=list[ObservationResponse])
@router.get("/", response_model=list[ObservationResponse])
def list_observations(
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if current_user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen geldige school gekoppeld",
        )

    return [
        ObservationRepository(db).to_response(observation)
        for observation in ObservationRepository(db).get_all(current_user.school_id)
    ]


@router.get("/{observation_id}", response_model=ObservationResponse)
def get_observation(
    observation_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if current_user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen geldige school gekoppeld",
        )

    observation = ObservationRepository(db).get_by_id(observation_id, current_user.school_id)
    if not observation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observatie niet gevonden")

    return ObservationRepository(db).to_response(observation)


@router.put("/{observation_id}", response_model=ObservationResponse)
def update_observation(
    observation_id: int,
    payload: ObservationUpdate,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if current_user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen geldige school gekoppeld",
        )

    observation = ObservationRepository(db).get_by_id(observation_id, current_user.school_id)
    if not observation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observatie niet gevonden")

    return ObservationRepository(db).to_response(ObservationRepository(db).update(observation, payload))


@router.delete("/{observation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_observation(
    observation_id: int,
    db=Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if current_user.school_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen geldige school gekoppeld",
        )

    observation = ObservationRepository(db).get_by_id(observation_id, current_user.school_id)
    if not observation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observatie niet gevonden")

    ObservationRepository(db).delete(observation)
