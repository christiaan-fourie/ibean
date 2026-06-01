'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query as firestoreQuery } from 'firebase/firestore';
import db from '../../utils/firebase';

export function useCollectionLive(collectionName, options = {}) {
  const { queryBuilder } = options;
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const collectionRef = collection(db, collectionName);
    const source = queryBuilder ? firestoreQuery(collectionRef, ...queryBuilder) : collectionRef;

    const unsubscribe = onSnapshot(
      source,
      (snapshot) => {
        setData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setIsLoading(false);
      },
      (err) => {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, queryBuilder]);

  return { data, isLoading, error };
}
